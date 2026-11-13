import { randomUUID } from "node:crypto";
import { schema, type Db } from "@heartroom/db";
import { openTestDb } from "@heartroom/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "../logger.ts";
import {
  createVoiceMeter,
  createVoiceUsageStore,
  monthStartUtc,
  type VoiceUsageStore,
} from "./usage.ts";

let db: Db;
let close: () => Promise<void>;
let store: VoiceUsageStore;
const log = createLogger("silent");

beforeAll(async () => {
  ({ db, close } = await openTestDb());
  store = createVoiceUsageStore(db);
}, 30_000);

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(schema.voiceUsage);
});

const at = (iso: string) => new Date(iso);

describe("voice usage store", () => {
  it("opens one session per join (a retried webhook is ignored) and closes it with its minutes", async () => {
    const room = randomUUID();
    await store.open(room, "asha", at("2026-11-13T10:00:00Z"));
    await store.open(room, "asha", at("2026-11-13T10:00:05Z"));
    expect(await store.close(room, "asha", at("2026-11-13T10:12:30Z"))).toBe(12.5);
    // Nothing left open: a repeated "left" closes nothing.
    expect(await store.close(room, "asha", at("2026-11-13T10:20:00Z"))).toBe(0);
    expect(await db.select().from(schema.voiceUsage)).toHaveLength(1);
  });

  it("closes crash leftovers at 3 hours and sums the month", async () => {
    const room = randomUUID();
    await store.open(room, "asha", at("2026-11-01T00:00:00Z"));
    await store.open(room, "bilal", at("2026-11-13T09:00:00Z"));
    await store.close(room, "bilal", at("2026-11-13T09:30:00Z"));
    await store.open(room, "chitra", at("2026-10-31T23:00:00Z")); // last month
    await store.closeStale(at("2026-11-13T07:00:00Z"));
    expect(await store.minutesSince(at("2026-11-01T00:00:00Z"))).toBe(180 + 30);
  });
});

describe("voice meter", () => {
  it("rebuilds the month on boot, adds closed sessions, and rests at the cap", async () => {
    const room = randomUUID();
    let now = Date.parse("2026-11-13T12:00:00Z");
    await store.open(room, "asha", at("2026-11-13T08:00:00Z"));
    await store.close(room, "asha", at("2026-11-13T08:50:00Z"));
    const meter = createVoiceMeter({ store, capMinutes: 60, log, now: () => now });
    await meter.boot();
    expect(meter.monthMinutes()).toBe(50);
    expect(meter.isResting()).toBe(false);

    await meter.joined(room, "bilal", at("2026-11-13T12:00:00Z"));
    await meter.left(room, "bilal", at("2026-11-13T12:10:00Z"));
    expect(meter.monthMinutes()).toBe(60);
    expect(meter.isResting()).toBe(true);

    // A new month starts from zero without a restart.
    now = Date.parse("2026-12-01T00:00:01Z");
    expect(meter.isResting()).toBe(false);
  });

  it("when the database fails, then voice goes on and nothing throws", async () => {
    const broken: VoiceUsageStore = {
      open: () => Promise.reject(new Error("down")),
      close: () => Promise.reject(new Error("down")),
      closeStale: () => Promise.reject(new Error("down")),
      minutesSince: () => Promise.reject(new Error("down")),
    };
    const meter = createVoiceMeter({ store: broken, capMinutes: 10, log });
    await expect(meter.boot()).resolves.toBeUndefined();
    await expect(meter.left("r", "u", new Date())).resolves.toBeUndefined();
    expect(meter.isResting()).toBe(false);
  });

  it("counts months in UTC", () => {
    expect(monthStartUtc(Date.parse("2026-11-30T23:59:59Z")).toISOString()).toBe(
      "2026-11-01T00:00:00.000Z",
    );
  });
});
