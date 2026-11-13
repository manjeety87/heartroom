import { randomBytes } from "node:crypto";
import { defineRoom, defineServer, type Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, type Room } from "@colyseus/sdk";
import { openTestDb } from "@heartroom/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTokenVerifier } from "../auth/verify-token.ts";
import { createSealer } from "../checkpoint.ts";
import { createLogger } from "../logger.ts";
import { createDbStore } from "../persistence/store.ts";
import type { Voice } from "../voice/voice.ts";
import { createGameRoom } from "./GameRoom.ts";

/**
 * More of the room with a real server: presence (is the room tab on screen?) and Word Guess. Its own
 * file because the join rate limits are per process and GameRoom.test.ts uses most of a minute's joins.
 */

const PORT = 2654;
let server: Server;
let closeDb: () => Promise<void>;

const voiceCalls: string[] = [];
const voice: Voice = {
  isEnabled: true,
  url: "wss://voice.test",
  mintToken: () => Promise.resolve("token"),
  setCanPublish: () => Promise.resolve(),
  remove: (_room, identity) => {
    voiceCalls.push(`remove:${identity}`);
    return Promise.resolve();
  },
};

beforeAll(async () => {
  const opened = await openTestDb();
  closeDb = opened.close;
  server = defineServer({
    transport: new WebSocketTransport(),
    greet: false,
    rooms: {
      room: defineRoom(
        createGameRoom({
          verifyToken: createTokenVerifier({
            isProduction: false,
            keys: () => Promise.reject(new Error("dev tokens only")),
          }),
          log: createLogger("silent"),
          sealer: createSealer({ current: randomBytes(32) }),
          store: createDbStore(opened.db),
          bootId: "presence-boot",
          voice,
          isVoiceResting: () => false,
          spectatorVoiceIdleMs: 100,
        }),
      ),
    },
  });
  await server.listen(PORT);
}, 30_000);

afterAll(async () => {
  await server.gracefullyShutdown(false);
  await closeDb();
});

type Player = {
  readonly room: Room;
  readonly inbox: { type: string; payload: Record<string, unknown> }[];
  waitFor(
    type: string,
    test?: (payload: Record<string, unknown>) => boolean,
  ): Promise<Record<string, unknown>>;
  send(payload: Record<string, unknown>): void;
};

function wrap(room: Room): Player {
  const player: Player = {
    room,
    inbox: [],
    async waitFor(type, test = () => true) {
      for (let waited = 0; waited < 3_000; waited += 10) {
        const found = player.inbox.find((m) => m.type === type && test(m.payload));
        if (found !== undefined) {
          player.inbox.splice(player.inbox.indexOf(found), 1);
          return found.payload;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`no "${type}" message arrived`);
    },
    send(payload) {
      room.send(payload["type"] as string, payload);
    },
  };
  room.onMessage("*", (type, payload: Record<string, unknown>) => {
    player.inbox.push({ type: String(type), payload });
  });
  return player;
}

const client = (user: string) => {
  const c = new Client(`ws://localhost:${String(PORT)}`);
  c.auth.token = `dev:${user}`;
  return c;
};
const create = async (user: string, nickname: string) =>
  wrap(await client(user).create("room", { nickname }));
const join = async (code: string, user: string, nickname: string) =>
  wrap(await client(user).joinById(code, { nickname }));

const until = async (check: () => boolean) => {
  for (let waited = 0; waited < 3_000 && !check(); waited += 10) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(check()).toBe(true);
};

const QUICK = { size: 3, linesToWin: 1, timer: "chill", firstSeat: 0 };
const GRID_A = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const GRID_B = [9, 8, 7, 6, 5, 4, 3, 2, 1];

describe("presence", () => {
  it("when a tab is hidden, then an away-only clock runs for that player and a spectator leaves voice", async () => {
    const host = await create("h1", "Hema");
    const code = host.room.roomId;
    const guest = await join(code, "h2", "Ishan");
    host.send({
      type: "host",
      kind: "config",
      gameId: "bingo",
      config: { ...QUICK, timer: "away-only" },
    });
    await host.waitFor("room", (r) => r["gameId"] === "bingo");
    host.send({ type: "host", kind: "start" });
    await host.waitFor("room", (r) => r["phase"] === "playing");
    let id = 0;
    for (const [who, grid] of [
      [host, GRID_A],
      [guest, GRID_B],
    ] as const) {
      who.send({
        type: "intent",
        clientActionId: `p${String(id++)}`,
        turnSeq: 0,
        action: { type: "fill", grid },
      });
    }
    await host.waitFor("game", (g) => g["seq"] === 2);
    host.send({ type: "intent", clientActionId: "r1", turnSeq: 2, action: { type: "ready" } });
    await guest.waitFor("game", (g) => g["seq"] === 3);
    guest.send({ type: "intent", clientActionId: "r2", turnSeq: 3, action: { type: "ready" } });

    // Both on screen: the turn's clock is paused.
    const paused = await host.waitFor(
      "deadline",
      (d) => (d["deadline"] as { key?: string } | null)?.key?.startsWith("turn") === true,
    );
    const turn = paused["deadline"] as { seat: number; msLeft: number | null };
    expect(turn.msLeft).toBeNull();
    const players = (await host.waitFor("room", () => true))["matchPlayers"] as {
      userId: string;
    }[];
    const caller = players[turn.seat]?.userId === "dev-h1" ? host : guest;

    // The caller switches apps: their clock runs. Back on screen: paused again.
    caller.send({ type: "presence", isVisible: false });
    expect(
      await host.waitFor(
        "deadline",
        (d) => typeof (d["deadline"] as { msLeft?: unknown } | null)?.msLeft === "number",
      ),
    ).toBeDefined();
    caller.send({ type: "presence", isVisible: true });
    expect(
      await host.waitFor(
        "deadline",
        (d) => (d["deadline"] as { msLeft?: unknown } | null)?.msLeft === null,
      ),
    ).toBeDefined();

    // A spectator who hides the room loses voice after a while; one who comes back in time keeps it.
    const watcher = await join(code, "h3", "Jaya");
    watcher.send({ type: "presence", isVisible: false });
    watcher.send({ type: "presence", isVisible: true });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(voiceCalls).not.toContain("remove:dev-h3");
    watcher.send({ type: "presence", isVisible: false });
    await until(() => voiceCalls.includes("remove:dev-h3"));
    await Promise.all([host.room.leave(), guest.room.leave(), watcher.room.leave()]);
  });
});

describe("word guess in a room", () => {
  it("plays a whole game; nobody sees the other secret before the end", async () => {
    const host = await create("w1", "Riya");
    const code = host.room.roomId;
    const guest = await join(code, "w2", "Kabir");
    const raw: string[] = [];
    for (const p of [host, guest]) {
      p.room.onMessage("*", (_type, payload: unknown) => {
        raw.push(JSON.stringify(payload));
      });
    }

    host.send({
      type: "host",
      kind: "config",
      gameId: "word-guess",
      config: { length: 5, maxGuesses: 5 },
    });
    await host.waitFor("room", (r) => r["gameId"] === "word-guess");
    host.send({ type: "host", kind: "start" });
    await host.waitFor("room", (r) => r["phase"] === "playing");

    // A made-up word is refused; an everyday word is accepted.
    host.send({
      type: "intent",
      clientActionId: "s0",
      turnSeq: 0,
      action: { type: "set", word: "qzxyw" },
    });
    expect(await host.waitFor("error")).toMatchObject({ code: "RULE_VIOLATION" });
    host.send({
      type: "intent",
      clientActionId: "s1",
      turnSeq: 0,
      action: { type: "set", word: "apple" },
    });
    await host.waitFor("ack", (a) => a["clientActionId"] === "s1");
    guest.send({
      type: "intent",
      clientActionId: "s2",
      turnSeq: 1,
      action: { type: "set", word: "crane" },
    });
    await guest.waitFor("ack", (a) => a["clientActionId"] === "s2");
    expect(
      raw
        .filter((m) => m.includes('"type":"game"'))
        .some((m) => m.includes("apple") && m.includes("crane")),
    ).toBe(false);

    host.send({
      type: "intent",
      clientActionId: "g1",
      turnSeq: 2,
      action: { type: "guess", word: "CRANE" },
    });
    await host.waitFor("ack", (a) => a["clientActionId"] === "g1");
    // The guest still guessing hasn't seen "apple" anywhere; the host's solved row is visible to both.
    expect(raw.some((m) => m.includes("apple") && !m.includes('"yourSecret":"apple"'))).toBe(false);
    guest.send({ type: "intent", clientActionId: "g2", turnSeq: 3, action: { type: "give_up" } });

    await host.waitFor("room", (r) => r["phase"] === "results");
    const end = await guest.waitFor(
      "game",
      (g) => (g["view"] as { phase?: string }).phase === "done",
    );
    expect(end["view"]).toMatchObject({ theirSecret: "apple", yourSecret: "crane" });
    await Promise.all([host.room.leave(), guest.room.leave()]);
  });
});
