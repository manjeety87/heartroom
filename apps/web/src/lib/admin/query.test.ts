import { randomUUID } from "node:crypto";
import { schema, type Db } from "@heartroom/db";
import { openTestDb } from "@heartroom/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readAdminStats } from "./query.ts";

let db: Db;
let close: () => Promise<void>;

const NOW = new Date("2026-11-13T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60_000);

async function game(options: {
  gameId?: string;
  endedAt: Date;
  status?: "finished" | "abandoned";
  seats: readonly (readonly [user: string, nickname: string, share: number])[];
}) {
  const id = randomUUID();
  await db.insert(schema.matches).values({
    id,
    gameId: options.gameId ?? "bingo",
    moduleVersion: 1,
    config: {},
    seed: new Uint8Array([1]),
    startedAt: options.endedAt,
    endedAt: options.endedAt,
    status: options.status ?? "finished",
    ranked: false,
    playerCount: options.seats.length,
  });
  await db.insert(schema.matchPlayers).values(
    options.seats.map(([userId, nickname, winShare], seat) => ({
      matchId: id,
      userId,
      seat,
      nickname,
      winShare,
    })),
  );
}

beforeAll(async () => {
  ({ db, close } = await openTestDb());
  await db.insert(schema.user).values([
    { id: "asha", name: "", email: "asha@example.invalid" },
    { id: "bilal", name: "", email: "bilal@example.invalid" },
    { id: "guest", name: "", email: "guest@example.invalid", isAnonymous: true },
  ]);
  await game({
    endedAt: daysAgo(10),
    seats: [
      ["asha", "Ash", 0.5],
      ["guest", "Gia", 0.5],
    ],
  });
  await game({
    endedAt: daysAgo(1),
    seats: [
      ["asha", "Asha", 1],
      ["bilal", "Bilal", 0],
    ],
  });
  await game({
    endedAt: daysAgo(40),
    seats: [
      ["bilal", "B", 1],
      ["guest", "Gia", 0],
    ],
  });
  await game({
    endedAt: daysAgo(2),
    status: "abandoned",
    seats: [
      ["asha", "Asha", 0],
      ["bilal", "Bilal", 0],
    ],
  });
  await game({
    gameId: "word-guess",
    endedAt: daysAgo(3),
    seats: [
      ["bilal", "Bilal", 1],
      ["guest", "Gia", 0],
    ],
  });

  const room = randomUUID();
  await db.insert(schema.voiceUsage).values([
    { roomId: room, userId: "asha", joinedAt: daysAgo(1), leftAt: daysAgo(1), minutes: 12.5 },
    { roomId: room, userId: "bilal", joinedAt: daysAgo(30), leftAt: daysAgo(30), minutes: 99 },
    { roomId: room, userId: "guest", joinedAt: NOW },
  ]);
  await db.insert(schema.roomEvents).values([
    { roomId: room, type: "created", at: daysAgo(0.5) },
    { roomId: room, type: "kicked", at: daysAgo(0.5), data: { userId: "x" } },
    { roomId: room, type: "closed", at: daysAgo(0.4), data: { reason: "admin" } },
    { roomId: randomUUID(), type: "closed", at: daysAgo(0.4), data: { reason: "empty" } },
    { roomId: randomUUID(), type: "created", at: daysAgo(3) },
  ]);
}, 30_000);

afterAll(async () => {
  await close();
});

describe("readAdminStats", () => {
  it("counts games per game and window, with the abandoned rate", async () => {
    const stats = await readAdminStats(db, NOW);
    expect(stats.games).toEqual([
      { gameId: "bingo", total: 4, last7Days: 2, last30Days: 3, abandoned: 1, abandonedRate: 0.25 },
      {
        gameId: "word-guess",
        total: 1,
        last7Days: 1,
        last30Days: 1,
        abandoned: 0,
        abandonedRate: 0,
      },
    ]);
  });

  it("ranks winners per game by finished games, named by their last nickname", async () => {
    const { winners } = await readAdminStats(db, NOW);
    expect(winners.find((w) => w.gameId === "bingo")?.rows).toEqual([
      { name: "Asha", isGuest: false, played: 2, wins: 1.5 },
      { name: "Bilal", isGuest: false, played: 2, wins: 1 },
      { name: "Gia", isGuest: true, played: 2, wins: 0.5 },
    ]);
  });

  it("sums this month's voice minutes and counts the last day's room events", async () => {
    const stats = await readAdminStats(db, NOW);
    expect(stats.voice).toEqual({ monthMinutes: 12.5, openSessions: 1 });
    expect(stats.rooms24h).toEqual({ created: 1, closedByAdmin: 1, kicked: 1 });
  });
});
