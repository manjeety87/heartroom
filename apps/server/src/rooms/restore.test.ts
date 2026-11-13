import { randomBytes } from "node:crypto";
import { defineRoom, defineServer, type Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, type Room } from "@colyseus/sdk";
import { CLOSE_CODES, joinError, type JoinError } from "@heartroom/protocol";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTokenVerifier } from "../auth/verify-token.ts";
import { createSealer } from "../checkpoint.ts";
import { createLogger } from "../logger.ts";
import { openTestDb } from "@heartroom/db/testing";
import { schema, type Db } from "@heartroom/db";
import { eq } from "drizzle-orm";
import { createDbStore, type RoomStore } from "../persistence/store.ts";
import { createGameRoom } from "./GameRoom.ts";

/**
 * Kill the server mid-game and bring the game back (design doc › Phase 2 check): one server process,
 * shut down, then a new one with another boot id and the same key, as after a deploy. Players hand
 * back the checkpoints they were sent and must find the same seats, grids and calls.
 */

const PORT = 2652;
const sealer = createSealer({ current: randomBytes(32) });
let running: Server | null = null;
// One database for both "processes", as in production.
let db: Db;
let closeDb: () => Promise<void>;
let store: RoomStore;

beforeAll(async () => {
  ({ db, close: closeDb } = await openTestDb());
  store = createDbStore(db);
}, 30_000);

afterAll(async () => {
  await closeDb();
});

async function startServer(bootId: string): Promise<Server> {
  const server = defineServer({
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
          bootId,
        }),
      ),
    },
  });
  await server.listen(PORT);
  running = server;
  return server;
}

async function stopServer() {
  if (running === null) return;
  await running.gracefullyShutdown(false);
  running = null;
  // The port is released a moment after shutdown resolves; the next "process" needs it.
  await new Promise((resolve) => setTimeout(resolve, 100));
}

afterEach(stopServer);

type Player = {
  readonly room: Room;
  /** Every checkpoint received, oldest first. */
  readonly checkpoints: string[];
  latest: Record<string, Record<string, unknown>>;
  closedWith: number | null;
  until(check: () => boolean): Promise<void>;
  send(payload: Record<string, unknown>): void;
};

function wrap(room: Room): Player {
  const player: Player = {
    room,
    checkpoints: [],
    latest: {},
    closedWith: null,
    async until(check) {
      for (let waited = 0; waited < 8_000 && !check(); waited += 10) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(check()).toBe(true);
    },
    send(payload) {
      room.send(payload["type"] as string, payload);
    },
  };
  room.onMessage("*", (type, payload: Record<string, unknown>) => {
    if (type === "checkpoint") player.checkpoints.push(payload["checkpoint"] as string);
    player.latest[String(type)] = payload;
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

const seqOf = (p: Player) => (p.latest["game"]?.["seq"] as number | undefined) ?? -1;
const QUICK = { size: 3, linesToWin: 3, timer: "chill", firstSeat: 0 };
const GRID_A = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const GRID_B = [9, 8, 7, 6, 5, 4, 3, 2, 1];

/** Asha (host) and Bilal in a started 3×3 game with both grids filled and two numbers called. */
async function gameInProgress(host = "asha", guest = "bilal") {
  await startServer("boot-1");
  // Each test seats its own people: the per-user create limit (5 a minute) spans the whole file.
  const asha = wrap(await client(host).create("room", { nickname: "Asha" }));
  const bilal = wrap(await client(guest).joinById(asha.room.roomId, { nickname: "Bilal" }));
  asha.send({ type: "host", kind: "config", gameId: "bingo", config: QUICK });
  await asha.until(() => asha.latest["room"]?.["gameId"] === "bingo");
  asha.send({ type: "host", kind: "start" });
  await asha.until(() => seqOf(asha) === 0);

  let id = 0;
  const play = async (who: Player, action: Record<string, unknown>) => {
    const before = seqOf(who);
    who.send({ type: "intent", clientActionId: `m${String(id++)}`, turnSeq: before, action });
    await who.until(() => seqOf(who) > before);
  };
  await play(asha, { type: "fill", grid: GRID_A });
  await play(bilal, { type: "fill", grid: GRID_B });
  await play(asha, { type: "ready" });
  await play(bilal, { type: "ready" });
  await play(asha, { type: "call", n: 5 });
  // Bilal's last checkpoint from before the next call: the copy a sore loser would keep.
  await bilal.until(() => seqOf(bilal) === 5);
  const olderForBilal = bilal.checkpoints.at(-1)!;
  await play(bilal, { type: "call", n: 1 });
  await asha.until(() => seqOf(asha) === 6);
  // The checkpoint is sealed just after the views go out.
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { asha, bilal, olderForBilal, code: asha.room.roomId };
}

async function refusal(attempt: Promise<unknown>): Promise<JoinError> {
  try {
    await attempt;
  } catch (error) {
    return joinError.parse(JSON.parse((error as Error).message));
  }
  throw new Error("the join was not refused");
}

describe("restoring a room after a restart", () => {
  it("brings the game back for both players, from the newest checkpoint", async () => {
    const { asha, bilal, olderForBilal, code } = await gameInProgress();
    const ashaView = asha.latest["game"];
    const bilalView = bilal.latest["game"];
    const ashaCheckpoint = asha.checkpoints.at(-1)!;

    await stopServer();
    await asha.until(() => asha.closedWith !== null);
    expect(asha.closedWith).toBe(CLOSE_CODES.RESTARTING);
    await startServer("boot-2");

    // Asha brings the room back; Bilal hands in an older copy, which must not win.
    const asha2 = wrap(
      await client("asha").create("room", { nickname: "Asha", resume: ashaCheckpoint }),
    );
    expect(asha2.room.roomId).toBe(code);
    // While the room waits for its players, someone without a checkpoint is told to wait.
    expect((await refusal(client("zed").joinById(code, { nickname: "Zed" }))).code).toBe(
      "ROOM_RESTORING",
    );
    const bilal2 = wrap(
      await client("bilal").joinById(code, { nickname: "Bilal", resume: olderForBilal }),
    );

    await asha2.until(() => asha2.latest["game"] !== undefined);
    await bilal2.until(() => bilal2.latest["game"] !== undefined);
    expect(asha2.latest["game"]).toEqual(ashaView);
    expect(bilal2.latest["game"]).toEqual(bilalView);
    expect(asha2.latest["room"]).toMatchObject({ phase: "playing", hostId: "dev-asha" });

    // The game goes on: it is Asha's turn again, and her call is accepted.
    asha2.send({
      type: "intent",
      clientActionId: "after",
      turnSeq: 6,
      action: { type: "call", n: 9 },
    });
    await asha2.until(() => seqOf(asha2) === 7);
    await asha2.until(() => asha2.checkpoints.length > 0);
  });

  it("when only one player comes back, then the room returns to its lobby", async () => {
    const { asha, code } = await gameInProgress();
    const checkpoint = asha.checkpoints.at(-1)!;
    await stopServer();
    await startServer("boot-2");

    const asha2 = wrap(
      await client("asha").create("room", { nickname: "Asha", resume: checkpoint }),
    );
    // The 5 s window passes with Bilal still away.
    await asha2.until(() => asha2.latest["room"] !== undefined);
    expect(asha2.latest["room"]).toMatchObject({ code, phase: "lobby", hostId: "dev-asha" });
    expect(asha2.latest["game"]).toBeUndefined();
    // The lost game is on record as abandoned, so its checkpoint can never bring it back.
    for (let waited = 0; waited < 3_000; waited += 20) {
      if ((await db.select().from(schema.matches)).length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(await db.select().from(schema.matches)).toMatchObject([
      { status: "abandoned", ranked: false },
    ]);
  }, 15_000); // waits out the 5 s restore window

  it("refuses an edited checkpoint and one from the server that is still running", async () => {
    const { asha } = await gameInProgress();
    const checkpoint = asha.checkpoints.at(-1)!;
    const edited = `${checkpoint.slice(0, -2)}${checkpoint.endsWith("A") ? "B" : "A"}A`;
    expect(
      (await refusal(client("asha").create("room", { nickname: "Asha", resume: edited }))).code,
    ).toBe("CHECKPOINT_REJECTED");
    // Same process: the room is alive, so there is nothing to bring back.
    expect(
      (await refusal(client("asha").create("room", { nickname: "Asha", resume: checkpoint }))).code,
    ).toBe("CHECKPOINT_REJECTED");
  });

  it("when everyone left before the crash, then the room's old checkpoint can't revive it", async () => {
    const { asha, bilal } = await gameInProgress("dina", "esha");
    const checkpoint = asha.checkpoints.at(-1)!;
    // Everyone leaves on purpose: the room closes and says so in room_events.
    await Promise.all([asha.room.leave(true), bilal.room.leave(true)]);
    for (let waited = 0; waited < 3_000; waited += 20) {
      const closed = await db
        .select()
        .from(schema.roomEvents)
        .where(eq(schema.roomEvents.type, "closed"));
      if (closed.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await stopServer();
    await startServer("boot-2");
    const asha2 = wrap(
      await client("dina").create("room", { nickname: "Asha", resume: checkpoint }),
    );
    await asha2.until(() => asha2.closedWith !== null);
    expect(asha2.closedWith).toBe(CLOSE_CODES.ROOM_CLOSED);
  }, 15_000);
});
