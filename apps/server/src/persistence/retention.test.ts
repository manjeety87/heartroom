import { randomUUID } from "node:crypto";
import { schema, type Db } from "@heartroom/db";
import { openTestDb } from "@heartroom/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearOldActions } from "./retention.ts";

let db: Db;
let close: () => Promise<void>;

const NOW = new Date("2026-11-15T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60_000);

async function match(endedAt: Date): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.matches).values({
    id,
    gameId: "bingo",
    moduleVersion: 1,
    config: {},
    seed: new Uint8Array([1]),
    startedAt: endedAt,
    endedAt,
    status: "finished",
    ranked: true,
    playerCount: 2,
    actions: [{ seat: 0, by: "player" }],
  });
  return id;
}

beforeAll(async () => {
  ({ db, close } = await openTestDb());
}, 30_000);

afterAll(async () => {
  await close();
});

describe("clearOldActions", () => {
  it("empties the move lists of games older than 30 days and keeps everything else", async () => {
    const old = await match(daysAgo(31));
    const recent = await match(daysAgo(29));
    expect(await clearOldActions(db, NOW)).toBe(1);
    const rows = await db.select().from(schema.matches);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(old)).toMatchObject({ actions: null, status: "finished", ranked: true });
    expect(byId.get(recent)?.actions).not.toBeNull();
    // Already cleared rows aren't touched again.
    expect(await clearOldActions(db, NOW)).toBe(0);
  });
});
