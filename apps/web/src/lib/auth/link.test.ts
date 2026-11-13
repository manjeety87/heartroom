import { randomUUID } from "node:crypto";
import { schema, type Db } from "@heartroom/db";
import { openTestDb } from "@heartroom/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { moveGuestToAccount } from "./link.ts";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await openTestDb());
}, 30_000);

afterAll(async () => {
  await close();
});

const AGE = new Date("2026-11-01T10:00:00Z");

async function user(id: string, ageConfirmedAt: Date | null = null) {
  await db.insert(schema.user).values({
    id,
    name: "",
    email: `${id}@example.invalid`,
    isAnonymous: id.startsWith("guest"),
    ageConfirmedAt,
  });
}

async function gamePlayedBy(userId: string) {
  const id = randomUUID();
  await db.insert(schema.matches).values({
    id,
    gameId: "bingo",
    moduleVersion: 1,
    config: {},
    seed: new Uint8Array([1]),
    startedAt: AGE,
    endedAt: AGE,
    status: "finished",
    ranked: false,
    playerCount: 2,
  });
  await db.insert(schema.matchPlayers).values([
    { matchId: id, userId, seat: 0, nickname: "Kabir", winShare: 1 },
    { matchId: id, userId: null, seat: 1, nickname: "Aarav", winShare: 0 },
  ]);
  return id;
}

const gamesOf = async (userId: string) =>
  (await db.select().from(schema.matchPlayers).where(eq(schema.matchPlayers.userId, userId)))
    .length;

describe("moveGuestToAccount", () => {
  it("moves every game and the 18+ answer to a new account, so the guest row can be deleted", async () => {
    await user("guest-1", AGE);
    await user("google-1");
    await gamePlayedBy("guest-1");
    await gamePlayedBy("guest-1");

    await moveGuestToAccount(db, "guest-1", "google-1");

    expect(await gamesOf("google-1")).toBe(2);
    expect(await gamesOf("guest-1")).toBe(0);
    const [account] = await db.select().from(schema.user).where(eq(schema.user.id, "google-1"));
    expect(account?.ageConfirmedAt).toEqual(AGE);
    // RESTRICT no longer blocks the delete Better Auth does next.
    await db.delete(schema.user).where(eq(schema.user.id, "guest-1"));
  });

  it("merges into an existing account and keeps that account's own 18+ date", async () => {
    const earlier = new Date("2026-10-01T00:00:00Z");
    await user("guest-2", AGE);
    await user("google-2", earlier);
    await gamePlayedBy("google-2");
    await gamePlayedBy("guest-2");

    await moveGuestToAccount(db, "guest-2", "google-2");

    expect(await gamesOf("google-2")).toBe(2);
    const [account] = await db.select().from(schema.user).where(eq(schema.user.id, "google-2"));
    expect(account?.ageConfirmedAt).toEqual(earlier);
  });
});
