import { randomBytes } from "node:crypto";
import { defineRoom, defineServer, type Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, type Room } from "@colyseus/sdk";
import { CLOSE_CODES, joinError, roomCodeInput, type JoinError } from "@heartroom/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTokenVerifier } from "../auth/verify-token.ts";
import { createSealer } from "../checkpoint.ts";
import { createLogger } from "../logger.ts";
import { openTestDb } from "@heartroom/db/testing";
import { schema, type Db } from "@heartroom/db";
import { createDbStore, type RoomStore } from "../persistence/store.ts";
import { createGameRoom } from "./GameRoom.ts";

/**
 * The room end to end: a real Colyseus server and real SDK clients over WebSockets, the same path a
 * browser takes. Deadlines are left to deadline.test.ts (real timers here would mean 15 s waits).
 */

const PORT = 2651;
let server: Server;
let db: Db;
let closeDb: () => Promise<void>;
let store: RoomStore;

const sealer = createSealer({ current: randomBytes(32) });

beforeAll(async () => {
  ({ db, close: closeDb } = await openTestDb());
  store = createDbStore(db);
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
          sealer,
          store,
          bootId: "test-boot",
        }),
      ),
    },
  });
  await server.listen(PORT);
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
  await closeDb();
});

type Message = { readonly type: string; readonly payload: Record<string, unknown> };

/** A connected player: every message it received, raw, plus helpers to wait for one. */
type Player = {
  readonly room: Room;
  readonly inbox: Message[];
  readonly raw: string[];
  closedWith: number | null;
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
    raw: [],
    closedWith: null,
    async waitFor(type, test = () => true) {
      for (let waited = 0; waited < 3_000; waited += 10) {
        const found = player.inbox.find((m) => m.type === type && test(m.payload));
        if (found !== undefined) {
          player.inbox.splice(player.inbox.indexOf(found), 1);
          return found.payload;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(
        `no "${type}" message arrived; inbox: ${JSON.stringify(player.inbox.filter((m) => m.type !== "room"))}`,
      );
    },
    send(payload) {
      room.send(payload["type"] as string, payload);
    },
  };
  room.onMessage("*", (type, payload: Record<string, unknown>) => {
    player.inbox.push({ type: String(type), payload });
    player.raw.push(JSON.stringify(payload));
  });
  room.onLeave((code) => {
    player.closedWith = code;
  });
  return player;
}

const client = (user: string) => {
  const c = new Client(`ws://localhost:${String(PORT)}`);
  c.auth.token = `dev:${user}`;
  return c;
};

async function create(user: string, nickname: string, color?: string) {
  return wrap(await client(user).create("room", { nickname, ...(color && { color }) }));
}

async function join(code: string, user: string, nickname: string, color?: string) {
  return wrap(await client(user).joinById(code, { nickname, ...(color && { color }) }));
}

/** The refusal a create/join came back with. */
async function refusal(attempt: Promise<unknown>): Promise<JoinError> {
  try {
    await attempt;
  } catch (error) {
    return joinError.parse(JSON.parse((error as Error).message));
  }
  throw new Error("the join was not refused");
}

/** Polls an async read until it returns rows (background writes land a moment later). */
async function eventually<T>(read: () => Promise<T[]>): Promise<T[]> {
  for (let waited = 0; waited < 3_000; waited += 20) {
    const rows = await read();
    if (rows.length > 0) return rows;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return read();
}

const until = async (check: () => boolean) => {
  for (let waited = 0; waited < 3_000 && !check(); waited += 10) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(check()).toBe(true);
};

const GRID_A = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const GRID_B = [9, 8, 7, 6, 5, 4, 3, 2, 1];
const QUICK = { size: 3, linesToWin: 1, timer: "chill", firstSeat: 0 };

describe("GameRoom", () => {
  it("when someone creates a room, then its id is a valid code and they are host in seat 0", async () => {
    const host = await create("c1", "Riya", "teal");
    expect(roomCodeInput.parse(host.room.roomId)).toBe(host.room.roomId);
    const room = await host.waitFor("room");
    expect(room).toMatchObject({
      hostId: "dev-c1",
      phase: "lobby",
      seats: [{ seat: 0, userId: "dev-c1", nickname: "Riya", color: "teal", isConnected: true }],
    });
    await host.room.leave();
  });

  it("refuses a bad token, a duplicate name (with a suggestion) and gives a free colour", async () => {
    const host = await create("d1", "Riya", "teal");
    const code = host.room.roomId;

    const anonymous = new Client(`ws://localhost:${String(PORT)}`);
    expect(await refusal(anonymous.joinById(code, { nickname: "X" }))).toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(await refusal(join(code, "d2", "riya"))).toMatchObject({
      code: "NAME_TAKEN",
      suggestion: "riya 2",
    });

    const guest = await join(code, "d2", "Arjun", "teal");
    const room = await guest.waitFor("room", (r) => (r["seats"] as unknown[]).length === 2);
    expect(room["seats"]).toMatchObject([
      { color: "teal" },
      { nickname: "Arjun", color: "indigo" },
    ]);
    await Promise.all([host.room.leave(), guest.room.leave()]);
  });

  it("plays a whole game without ever showing a player the other's grid", async () => {
    const a = await create("g1", "Asha");
    const b = await join(a.room.roomId, "g2", "Bilal");

    b.send({ type: "host", kind: "start" });
    expect(await b.waitFor("error")).toMatchObject({ code: "RULE_VIOLATION" });

    a.send({ type: "host", kind: "config", gameId: "bingo", config: QUICK });
    await a.waitFor("room", (r) => r["gameId"] === "bingo");
    a.send({ type: "host", kind: "start" });
    const playing = await a.waitFor("room", (r) => r["phase"] === "playing");
    // Names per game seat, so each browser can label the board without knowing the rotation.
    expect(playing["matchPlayers"]).toEqual([
      { userId: "dev-g1", nickname: "Asha", color: expect.any(String) as unknown },
      { userId: "dev-g2", nickname: "Bilal", color: expect.any(String) as unknown },
    ]);

    let seq = 0;
    let id = 0;
    /** Sends a move quoting the seq this player last saw, and waits for it to be accepted. */
    const play = async (who: Player, action: Record<string, unknown>, seenSeq = seq) => {
      const clientActionId = `a${String(id++)}`;
      who.send({ type: "intent", clientActionId, turnSeq: seenSeq, action });
      await who.waitFor("ack", (m) => m["clientActionId"] === clientActionId);
      seq++;
    };

    // Setup: both fill their grids at the same moment, from the same view (seq 0). Neither is stale.
    await Promise.all([
      play(a, { type: "fill", grid: GRID_A }, 0),
      play(b, { type: "fill", grid: GRID_B }, 0),
    ]);
    await play(a, { type: "ready" });
    await play(b, { type: "ready" });
    await b.waitFor("game", (g) => g["seq"] === 4);

    // A move from an earlier turn is refused; a repeated action id is acknowledged, not replayed.
    a.send({ type: "intent", clientActionId: "old", turnSeq: 0, action: { type: "call", n: 1 } });
    expect(await a.waitFor("error")).toMatchObject({ code: "STALE_TURN" });
    a.send({ type: "intent", clientActionId: "a0", turnSeq: 4, action: { type: "call", n: 1 } });
    expect(await a.waitFor("ack", (m) => m["clientActionId"] === "a0")).toBeDefined();

    // 1, 2, 3 is Asha's top row and Bilal's bottom row: one call completes both, a shared win.
    await play(a, { type: "call", n: 1 });
    await play(b, { type: "call", n: 2 });
    await play(a, { type: "call", n: 3 });
    await a.waitFor("room", (r) => r["phase"] === "results");
    const final = await a.waitFor("game", (g) => g["seq"] === 7);
    expect(final["view"]).toMatchObject({ phase: "done", winners: [0, 1] });

    // The server writes the match in the background: a shared win is half a win each.
    const saved = await eventually(() => db.select().from(schema.matches));
    expect(saved).toMatchObject([{ gameId: "bingo", status: "finished", playerCount: 2 }]);
    const seats = await db.select().from(schema.matchPlayers);
    expect(seats.map((p) => p.winShare)).toEqual([0.5, 0.5]);

    const beforeReveal = (raw: string[]) => raw.filter((m) => !m.includes('"reveal":{'));
    expect(beforeReveal(b.raw).some((m) => m.includes(JSON.stringify(GRID_A)))).toBe(false);
    expect(beforeReveal(a.raw).some((m) => m.includes(JSON.stringify(GRID_B)))).toBe(false);
    await Promise.all([a.room.leave(), b.room.leave()]);
  });

  it("when the same person joins again, then the old socket is closed as taken over", async () => {
    const host = await create("t1", "Tara");
    const first = await join(host.room.roomId, "t2", "Om");
    const second = await join(host.room.roomId, "t2", "Om");
    await until(() => first.closedWith === CLOSE_CODES.TAKEN_OVER);
    const room = await second.waitFor("room", (r) => (r["seats"] as unknown[]).length === 2);
    expect(room["seats"]).toMatchObject([
      { userId: "dev-t1" },
      { userId: "dev-t2", isConnected: true },
    ]);
    await Promise.all([host.room.leave(), second.room.leave()]);
  });

  it("when a player drops and reconnects, then they keep their seat and get the view", async () => {
    const a = await create("r1", "Asha");
    const b = await join(a.room.roomId, "r2", "Bilal");
    a.send({ type: "host", kind: "config", gameId: "bingo", config: QUICK });
    a.send({ type: "host", kind: "start" });
    await b.waitFor("game");

    const token = b.room.reconnectionToken;
    await b.room.leave(false);
    await a.waitFor(
      "room",
      (r) => (r["seats"] as { isConnected: boolean }[])[1]?.isConnected === false,
    );
    const back = wrap(await client("r2").reconnect(token));
    expect(await back.waitFor("game")).toMatchObject({ seq: 0, view: { kind: "seat", you: 1 } });
    await a.waitFor(
      "room",
      (r) => (r["seats"] as { isConnected: boolean }[])[1]?.isConnected === true,
    );
    await Promise.all([a.room.leave(), back.room.leave()]);
  });

  it("when the host kicks or locks, then the kicked can't return and strangers can't enter", async () => {
    const host = await create("k1", "Kavi");
    const code = host.room.roomId;
    const guest = await join(code, "k2", "Neel");
    host.send({ type: "host", kind: "kick", target: "dev-k2" });
    await until(() => guest.closedWith === CLOSE_CODES.KICKED);
    expect(await refusal(join(code, "k2", "Neel"))).toMatchObject({ code: "BANNED" });

    host.send({ type: "host", kind: "lock" });
    await host.waitFor("room", (r) => r["isLocked"] === true);
    expect(await refusal(join(code, "k3", "Zoya"))).toMatchObject({ code: "ROOM_LOCKED" });
    await host.room.leave();
  });

  it("when a message is malformed, then it is answered with an error and the socket stays open", async () => {
    const host = await create("m1", "Mira");
    host.send({ type: "intent", clientActionId: "x" });
    expect(await host.waitFor("error")).toMatchObject({ code: "INVALID_MESSAGE" });
    host.send({ type: "resync" });
    expect(host.closedWith).toBeNull();
    await host.room.leave();
  });
});
