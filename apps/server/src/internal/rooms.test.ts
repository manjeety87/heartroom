import { randomBytes } from "node:crypto";
import { createRouter, defineRoom, defineServer, type Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, type Room } from "@colyseus/sdk";
import { schema, type Db } from "@heartroom/db";
import { openTestDb } from "@heartroom/db/testing";
import { CLOSE_CODES, liveRoomsResponse } from "@heartroom/protocol";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTokenVerifier } from "../auth/verify-token.ts";
import { createSealer } from "../checkpoint.ts";
import { createLogger } from "../logger.ts";
import { createDbStore } from "../persistence/store.ts";
import { createGameRoom } from "../rooms/GameRoom.ts";
import type { Voice } from "../voice/voice.ts";
import { isStuck, liveRooms, STUCK_WITHOUT_CLOCK_MS } from "./live-rooms.ts";
import { adminEndpoints, createAdminApi, createAdminStore } from "./rooms.ts";

describe("isStuck", () => {
  const t0 = 1_000_000;
  it("only a game in play can be stuck, after twice its turn clock", () => {
    expect(isStuck("lobby", 0, 15_000, t0)).toBe(false);
    expect(isStuck("playing", t0 - 30_000, 15_000, t0)).toBe(false);
    expect(isStuck("playing", t0 - 30_001, 15_000, t0)).toBe(true);
  });
  it("without a clock, after ten minutes", () => {
    expect(isStuck("playing", t0 - STUCK_WITHOUT_CLOCK_MS, null, t0)).toBe(false);
    expect(isStuck("playing", t0 - STUCK_WITHOUT_CLOCK_MS - 1, null, t0)).toBe(true);
  });
});

const PORT = 2655;
let server: Server;
let db: Db;
let closeDb: () => Promise<void>;
let api: ReturnType<typeof createAdminApi>;

const voice: Voice = {
  isEnabled: true,
  url: "wss://voice.test",
  mintToken: () => Promise.resolve("token"),
  setCanPublish: () => Promise.resolve(),
  remove: () => Promise.resolve(),
};

beforeAll(async () => {
  ({ db, close: closeDb } = await openTestDb());
  await db.insert(schema.user).values([
    { id: "dev-boss", name: "", email: "boss@example.invalid", isAdmin: true },
    { id: "dev-plain", name: "", email: "plain@example.invalid" },
  ]);
  const verifyToken = createTokenVerifier({
    isProduction: false,
    keys: () => Promise.reject(new Error("dev tokens only")),
  });
  const log = createLogger("silent");
  api = createAdminApi({
    verifyToken,
    store: createAdminStore(db),
    voice: () => ({ isEnabled: true, monthMinutes: 12.5, capMinutes: 1000, isResting: false }),
    log,
  });
  server = defineServer({
    transport: new WebSocketTransport(),
    greet: false,
    rooms: {
      room: defineRoom(
        createGameRoom({
          verifyToken,
          log,
          sealer: createSealer({ current: randomBytes(32) }),
          store: createDbStore(db),
          bootId: "admin-boot",
          voice,
          isVoiceResting: () => false,
          trustProxy: 0,
        }),
      ),
    },
    routes: createRouter(adminEndpoints(api)),
  });
  await server.listen(PORT);
}, 30_000);

afterAll(async () => {
  await server.gracefullyShutdown(false);
  await closeDb();
});

const BOSS = "Bearer dev:boss";
const until = async (check: () => boolean | Promise<boolean>) => {
  for (let waited = 0; waited < 3_000 && !(await check()); waited += 10) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const inboxes = new WeakMap<Room, { type: string; payload: Record<string, unknown> }[]>();

async function enter(user: string, nickname: string, code?: string): Promise<Room> {
  const client = new Client(`ws://localhost:${String(PORT)}`);
  client.auth.token = `dev:${user}`;
  const room =
    code === undefined
      ? await client.create("room", { nickname })
      : await client.joinById(code, { nickname });
  const inbox: { type: string; payload: Record<string, unknown> }[] = [];
  inboxes.set(room, inbox);
  room.onMessage("*", (type, payload: Record<string, unknown>) => {
    inbox.push({ type: String(type), payload });
  });
  return room;
}

/** Waits for a message of `type` that passes `test` (taking it out of the inbox). */
async function next(room: Room, type: string, test: (m: Record<string, unknown>) => boolean) {
  const inbox = inboxes.get(room) ?? [];
  for (let waited = 0; waited < 3_000; waited += 10) {
    const found = inbox.findIndex((m) => m.type === type && test(m.payload));
    if (found >= 0) return inbox.splice(found, 1)[0]?.payload;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`no "${type}" message; got ${JSON.stringify(inbox.map((m) => m.payload))}`);
}

describe("admin routes", () => {
  it("answer 404 to anyone who isn't an admin", async () => {
    for (const auth of [null, "", "Bearer dev:plain", "Bearer dev:nobody", "Basic dev:boss"]) {
      expect((await api.listRooms(auth)).status).toBe(404);
      expect((await api.closeRoom(auth, "ABCDEF")).status).toBe(404);
    }
    const http = await fetch(`http://localhost:${String(PORT)}/internal/rooms`, {
      headers: { authorization: "Bearer dev:plain" },
    });
    expect(http.status).toBe(404);
  });

  it("list live rooms with the public view only, and close one with an audit row", async () => {
    const host = await enter("riya", "Riya");
    const code = host.roomId;
    const guest = await enter("kabir", "Kabir", code);
    host.send("host", {
      type: "host",
      kind: "config",
      gameId: "word-guess",
      config: { length: 5, maxGuesses: 5 },
    });
    await next(host, "room", (r) => r["gameId"] === "word-guess");
    host.send("host", { type: "host", kind: "start" });
    await next(host, "room", (r) => r["phase"] === "playing");
    // Joining mid-game makes Jaya a spectator.
    const watcher = await enter("jaya", "Jaya", code);
    const setWord = (room: Room, word: string, turnSeq: number) => {
      room.send("intent", {
        type: "intent",
        clientActionId: word,
        turnSeq,
        action: { type: "set", word },
      });
      return next(room, "ack", () => true);
    };
    await setWord(host, "apple", 0);
    await setWord(guest, "crane", 1);

    const roomUid = liveRooms.entries()[0]?.[0];
    if (roomUid === undefined) throw new Error("no live room");
    await db
      .insert(schema.voiceUsage)
      .values({ roomId: roomUid, userId: "dev-riya", joinedAt: new Date() });

    const listed = await api.listRooms(BOSS);
    expect(listed.status).toBe(200);
    const text = await listed.text();
    // Public view only: neither secret word, and no user ids.
    expect(text).not.toMatch(/apple|crane|dev-/i);
    const body = liveRoomsResponse.parse(JSON.parse(text));
    expect(body.voice).toMatchObject({ monthMinutes: 12.5, capMinutes: 1000 });
    expect(body.rooms).toHaveLength(1);
    expect(body.rooms[0]).toMatchObject({
      code,
      gameId: "word-guess",
      phase: "playing",
      spectators: 1,
      inVoice: 1,
      isStuck: false,
      seats: [
        { nickname: "Riya", isConnected: true },
        { nickname: "Kabir", isConnected: true },
      ],
    });
    expect(body.rooms[0]?.view).toMatchObject({
      gameId: "word-guess",
      state: { kind: "spectator" },
    });

    const closed = Promise.all(
      [host, guest, watcher].map(
        (room) =>
          new Promise<number>((resolve) => {
            room.onLeave(resolve);
          }),
      ),
    );
    const response = await fetch(
      `http://localhost:${String(PORT)}/internal/rooms/${code.toLowerCase()}/close`,
      { method: "POST", headers: { authorization: BOSS } },
    );
    expect(response.status).toBe(204);
    expect(await closed).toEqual(Array(3).fill(CLOSE_CODES.ROOM_CLOSED));

    // Closed means gone: no second close, an audit row, the game on record as abandoned.
    await until(() => liveRooms.entries().length === 0);
    expect((await api.closeRoom(BOSS, code)).status).toBe(404);
    expect(await db.select().from(schema.adminAudit)).toMatchObject([
      { adminId: "dev-boss", action: "close_room", target: roomUid },
    ]);
    const closedEvents = await db
      .select({ data: schema.roomEvents.data })
      .from(schema.roomEvents)
      .where(eq(schema.roomEvents.type, "closed"));
    expect(closedEvents).toEqual([{ data: { reason: "admin" } }]);
    const matches = () =>
      db
        .select({ status: schema.matches.status, ranked: schema.matches.ranked })
        .from(schema.matches);
    await until(async () => (await matches()).length > 0);
    expect(await matches()).toEqual([{ status: "abandoned", ranked: false }]);
  }, 20_000);
});
