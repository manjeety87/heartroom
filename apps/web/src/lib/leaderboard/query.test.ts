import { randomUUID } from "node:crypto";
import { schema, type Db } from "@heartroom/db";
import { openTestDb } from "@heartroom/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseFilters, type LeaderboardFilters } from "./filters.ts";
import { readLeaderboard } from "./query.ts";

let db: Db;
let close: () => Promise<void>;

const NOW = new Date("2026-11-13T12:00:00Z");
const PEOPLE = ["asha", "bilal", "chen", "dev", "esha"] as const;
const BINGO: LeaderboardFilters = { game: "bingo", period: "all", players: "any" };

beforeAll(async () => {
  ({ db, close } = await openTestDb());
  await db
    .insert(schema.user)
    .values([
      ...PEOPLE.map((id) => ({ id, name: "", email: `${id}@example.invalid`, isAnonymous: false })),
      { id: "guest", name: "", email: "guest@example.invalid", isAnonymous: true },
    ]);

  // Asha beats each of Bilal, Chen and Dev 4 times (12 games, 3 opponents): qualifies.
  for (const rival of ["bilal", "chen", "dev"])
    for (let i = 0; i < 4; i++) await game({ seats: ["asha", rival], shares: [1, 0] });
  // Bilal also beats Chen 6 times: 10 games, 2 opponents (a third comes later).
  for (let i = 0; i < 6; i++) await game({ seats: ["bilal", "chen"], shares: [1, 0] });
  // Esha plays the guest 12 times (guests are no opponents) and Dev once: she never qualifies.
  for (let i = 0; i < 12; i++) await game({ seats: ["esha", "guest"], shares: [1, 0] });
  // Not counted: unranked, abandoned, another game, old.
  await game({ seats: ["chen", "dev"], shares: [1, 0], ranked: false });
  await game({ seats: ["chen", "dev"], shares: [1, 0], status: "abandoned" });
  await game({ seats: ["chen", "dev"], shares: [1, 0], gameId: "word-guess" });
  await game({ seats: ["dev", "esha"], shares: [1, 0], endedAt: "2026-09-01T10:00:00Z" });
}, 30_000);

afterAll(async () => {
  await close();
});

let clock = 0;
async function game({
  seats,
  shares,
  ranked = true,
  status = "finished",
  gameId = "bingo",
  endedAt,
}: {
  seats: readonly string[];
  shares: readonly number[];
  ranked?: boolean;
  status?: "finished" | "abandoned";
  gameId?: string;
  endedAt?: string;
}) {
  const id = randomUUID();
  clock += 1;
  const end = endedAt === undefined ? new Date(NOW.getTime() - clock * 60_000) : new Date(endedAt);
  await db.insert(schema.matches).values({
    id,
    gameId,
    moduleVersion: 1,
    config: {},
    seed: new Uint8Array([1]),
    startedAt: end,
    endedAt: end,
    status,
    ranked,
    playerCount: seats.length,
  });
  await db.insert(schema.matchPlayers).values(
    seats.map((userId, seat) => ({
      matchId: id,
      userId,
      seat,
      nickname: userId.charAt(0).toUpperCase() + userId.slice(1),
      winShare: shares[seat] ?? 0,
    })),
  );
}

describe("readLeaderboard", () => {
  it("lists only people with 10+ ranked games against 3+ signed-in people", async () => {
    const board = await readLeaderboard(db, BINGO, null, NOW);
    expect(board.rows).toEqual([
      { rank: 1, isYou: false, name: "Asha", played: 12, wins: 12, winRate: 1 },
    ]);
    expect(board.you).toBeNull();
  });

  it("tells a signed-in viewer how far they are from the board", async () => {
    const bilal = await readLeaderboard(db, BINGO, "bilal", NOW);
    expect(bilal.you).toEqual({
      kind: "unranked",
      played: 10,
      opponents: 2,
      gamesNeeded: 0,
      opponentsNeeded: 1,
    });
    const esha = await readLeaderboard(db, BINGO, "esha", NOW);
    expect(esha.you).toMatchObject({ played: 13, opponents: 1, opponentsNeeded: 2 });
    expect((await readLeaderboard(db, BINGO, "asha", NOW)).you).toMatchObject({ kind: "ranked" });
    expect((await readLeaderboard(db, BINGO, "guest", NOW)).you).toBeNull();
  });

  it("filters by window, player count and game", async () => {
    await game({ seats: ["asha", "bilal", "dev"], shares: [0.5, 0.5, 0] });
    const all = await readLeaderboard(db, BINGO, "bilal", NOW);
    expect(all.rows.map((r) => [r.name, r.isYou, r.wins])).toEqual([
      ["Asha", false, 12.5],
      ["Bilal", true, 6.5],
    ]);
    // Only the 3-player game is in the 3–4 band: nobody has 10 games there.
    expect((await readLeaderboard(db, { ...BINGO, players: "3-4" }, null, NOW)).rows).toEqual([]);
    expect((await readLeaderboard(db, { ...BINGO, game: "word-guess" }, null, NOW)).rows).toEqual(
      [],
    );
    // A week back from NOW still holds every game except the September one.
    expect((await readLeaderboard(db, { ...BINGO, period: "week" }, null, NOW)).rows).toHaveLength(
      2,
    );
    const later = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000);
    expect((await readLeaderboard(db, { ...BINGO, period: "week" }, null, later)).rows).toEqual([]);
  });
});

describe("parseFilters", () => {
  it("falls back to defaults and drops the band for Word Guess", () => {
    expect(parseFilters({})).toEqual({ game: "bingo", period: "month", players: "any" });
    expect(parseFilters({ game: "chess", period: ["week", "all"], players: "9" })).toEqual({
      game: "bingo",
      period: "week",
      players: "any",
    });
    expect(parseFilters({ game: "word-guess", players: "5-6" })).toEqual({
      game: "word-guess",
      period: "month",
      players: "any",
    });
  });
});
