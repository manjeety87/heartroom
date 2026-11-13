import { randomUUID } from "node:crypto";
import { schema, type Db } from "@heartroom/db";
import { openTestDb } from "@heartroom/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { onlineHistorySchema } from "./online.ts";
import { readOnlineHistory } from "./query.ts";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await openTestDb());
  await db.insert(schema.user).values([
    { id: "kabir", name: "", email: "kabir@example.invalid", isAnonymous: false },
    { id: "aarav", name: "", email: "aarav@example.invalid", isAnonymous: true },
  ]);
}, 30_000);

afterAll(async () => {
  await close();
});

async function game(endedAt: string, status: "finished" | "abandoned", kabirShare: number) {
  const id = randomUUID();
  await db.insert(schema.matches).values({
    id,
    gameId: "bingo",
    moduleVersion: 1,
    config: { size: 5 },
    seed: new Uint8Array([1]),
    startedAt: new Date(endedAt),
    endedAt: new Date(endedAt),
    status,
    ranked: false,
    playerCount: 2,
  });
  await db.insert(schema.matchPlayers).values([
    { matchId: id, userId: "aarav", seat: 0, nickname: "Aarav", winShare: 1 - kabirShare },
    { matchId: id, userId: "kabir", seat: 1, nickname: "Kabir", winShare: kabirShare },
  ]);
  return id;
}

describe("readOnlineHistory", () => {
  it("lists my games newest first with everyone's names, and totals only finished games", async () => {
    const older = await game("2026-11-10T10:00:00Z", "finished", 1);
    const shared = await game("2026-11-12T10:00:00Z", "finished", 0.5);
    const lost = await game("2026-11-13T10:00:00Z", "abandoned", 0);

    const history = await readOnlineHistory(db, "kabir");
    expect(onlineHistorySchema.parse(history)).toEqual(history);
    expect(history.games.map((g) => g.id)).toEqual([lost, shared, older]);
    expect(history.games[1]).toMatchObject({
      you: 1,
      players: [
        { seat: 0, nickname: "Aarav", winShare: 0.5 },
        { seat: 1, nickname: "Kabir", winShare: 0.5 },
      ],
    });
    expect(history.stats).toEqual([{ gameId: "bingo", played: 2, wins: 1.5 }]);
  });

  it("when someone never played online, then there is nothing", async () => {
    expect(await readOnlineHistory(db, "nobody")).toEqual({ stats: [], games: [] });
  });
});
