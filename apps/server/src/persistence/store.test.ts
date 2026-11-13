import { randomUUID } from "node:crypto";
import { schema, type Db } from "@heartroom/db";
import { openTestDb } from "@heartroom/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PAIR_CAP_PER_DAY } from "./ranking.ts";
import { createDbStore, type MatchToRecord, type RoomStore } from "./store.ts";

let db: Db;
let close: () => Promise<void>;
let store: RoomStore;

beforeAll(async () => {
  ({ db, close } = await openTestDb());
  store = createDbStore(db);
  await db.insert(schema.user).values([
    { id: "asha", name: "Asha", email: "asha@example.invalid", isAnonymous: false },
    { id: "bilal", name: "Bilal", email: "bilal@example.invalid", isAnonymous: false },
    { id: "guest", name: "Guest", email: "guest@anonymous.invalid", isAnonymous: true },
  ]);
}, 30_000);

afterAll(async () => {
  await close();
});

const NOON = new Date("2026-11-13T06:30:00Z"); // 12:00 in India

function match(overrides: Partial<MatchToRecord> = {}): MatchToRecord {
  return {
    id: randomUUID(),
    gameId: "bingo",
    moduleVersion: 1,
    config: { size: 5, linesToWin: 5 },
    configIsRanked: true,
    seed: new Uint8Array([1, 2, 3]),
    startedAt: new Date(NOON.getTime() - 60_000),
    endedAt: NOON,
    status: "finished",
    users: ["asha", "bilal"],
    nicknames: ["Asha", "Bilal"],
    result: { winners: [0], placements: [1, 2], details: null },
    actions: [{ seat: 0, by: "player" }],
    ...overrides,
  };
}

const rowsFor = (id: string) =>
  db.select().from(schema.matchPlayers).where(eq(schema.matchPlayers.matchId, id));
const matchRow = async (id: string) =>
  (await db.select().from(schema.matches).where(eq(schema.matches.id, id)))[0];

describe("createDbStore", () => {
  it("writes the match and one row per seat with results and win shares", async () => {
    const m = match();
    await store.recordMatch(m);
    expect(await matchRow(m.id)).toMatchObject({
      status: "finished",
      ranked: true,
      playerCount: 2,
    });
    expect((await rowsFor(m.id)).sort((x, y) => x.seat - y.seat)).toMatchObject([
      { userId: "asha", seat: 0, nickname: "Asha", result: "win", placement: 1, winShare: 1 },
      { userId: "bilal", seat: 1, nickname: "Bilal", result: "loss", placement: 2, winShare: 0 },
    ]);
    expect(await store.isMatchRecorded(m.id)).toBe(true);
    expect(await store.isMatchRecorded(randomUUID())).toBe(false);
  });

  it("when the same match is written twice, then it is kept once", async () => {
    const m = match();
    await store.recordMatch(m);
    await store.recordMatch(m);
    expect(await rowsFor(m.id)).toHaveLength(2);
  });

  it("keeps development identities as seats with no account", async () => {
    const m = match({ users: ["dev-x", "dev-y"] });
    await store.recordMatch(m);
    expect((await rowsFor(m.id)).map((r) => r.userId)).toEqual([null, null]);
    expect((await matchRow(m.id))?.ranked).toBe(false);
  });

  it("when a guest is one of the two players, then the match is casual", async () => {
    const m = match({ users: ["asha", "guest"] });
    await store.recordMatch(m);
    expect((await matchRow(m.id))?.ranked).toBe(false);
  });

  it("when an abandoned match is written, then nobody wins and it is not ranked", async () => {
    const m = match({ status: "abandoned", result: null });
    await store.recordMatch(m);
    expect(await matchRow(m.id)).toMatchObject({ status: "abandoned", ranked: false });
    expect((await rowsFor(m.id)).every((r) => r.result === null && r.winShare === 0)).toBe(true);
  });

  it("when two players hit the daily pair cap, then their next game that day is casual", async () => {
    await db.insert(schema.user).values([
      { id: "c1", name: "C1", email: "c1@example.invalid", isAnonymous: false },
      { id: "c2", name: "C2", email: "c2@example.invalid", isAnonymous: false },
    ]);
    const pair = { users: ["c1", "c2"] };
    for (let i = 0; i < PAIR_CAP_PER_DAY; i++) await store.recordMatch(match(pair));
    const over = match(pair);
    await store.recordMatch(over);
    expect((await matchRow(over.id))?.ranked).toBe(false);
    // The next Indian day starts fresh.
    const tomorrow = match({ ...pair, endedAt: new Date(NOON.getTime() + 24 * 60 * 60_000) });
    await store.recordMatch(tomorrow);
    expect((await matchRow(tomorrow.id))?.ranked).toBe(true);
  });

  it("remembers rooms closed on purpose, by room id", async () => {
    const room = randomUUID();
    await store.recordRoomEvent(room, "created");
    expect(await store.isRoomClosed(room)).toBe(false);
    await store.recordRoomEvent(room, "closed", { reason: "empty" });
    expect(await store.isRoomClosed(room)).toBe(true);
    expect(await store.isRoomClosed(randomUUID())).toBe(false);
  });
});
