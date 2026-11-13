import { schema, type Db } from "@heartroom/db";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { Logger } from "../logger.ts";

/**
 * Voice minutes (design doc › Voice › Metering). LiveKit webhooks open and close one `voice_usage`
 * row per join; the month-to-date total lives in memory and decides the monthly cap.
 */

/** A session still open after this long is a crash leftover, closed at joined_at + 3 h. */
export const STALE_SESSION_MS = 3 * 60 * 60_000;

export type VoiceUsageStore = {
  /** Opens a session unless one is already open for this person in this room (webhook retries). */
  open(roomId: string, userId: string, at: Date): Promise<void>;
  /** Closes the open session(s) for this person in this room; returns the minutes closed. */
  close(roomId: string, userId: string, at: Date): Promise<number>;
  /** Closes every session opened before `before`, at joined_at + 3 h. */
  closeStale(before: Date): Promise<void>;
  /** Minutes of sessions that joined since `start` and are closed. */
  minutesSince(start: Date): Promise<number>;
};

const minutesBetween = (from: unknown, to: unknown) =>
  sql`round((extract(epoch from (${to} - ${from})) / 60)::numeric, 3)`;

export function createVoiceUsageStore(db: Db): VoiceUsageStore {
  const t = schema.voiceUsage;
  return {
    async open(roomId, userId, at) {
      await db.execute(sql`
        insert into ${t} (room_id, user_id, joined_at)
        select ${roomId}, ${userId}, ${at.toISOString()}
        where not exists (
          select 1 from ${t}
          where ${t.roomId} = ${roomId} and ${t.userId} = ${userId} and ${t.leftAt} is null
        )`);
    },
    async close(roomId, userId, at) {
      const closed = await db
        .update(t)
        .set({
          leftAt: at,
          // Never negative: a late "joined" webhook can carry a later time than the "left".
          minutes: sql`greatest(0, ${minutesBetween(t.joinedAt, at.toISOString())})`,
        })
        .where(and(eq(t.roomId, roomId), eq(t.userId, userId), isNull(t.leftAt)))
        .returning({ minutes: t.minutes });
      return closed.reduce((sum, row) => sum + (row.minutes ?? 0), 0);
    },
    async closeStale(before) {
      await db
        .update(t)
        .set({
          leftAt: sql`${t.joinedAt} + interval '3 hours'`,
          minutes: 180,
        })
        .where(and(isNull(t.leftAt), lt(t.joinedAt, before)));
    },
    async minutesSince(start) {
      const [row] = await db
        .select({ total: sql<string | null>`sum(${t.minutes})` })
        .from(t)
        .where(gte(t.joinedAt, start));
      return Number(row?.total ?? 0);
    },
  };
}

/** Calendar months in UTC, like LiveKit's own billing. */
export const monthStartUtc = (ms: number) => {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

export type VoiceMeter = {
  /** Rebuilds the month's total and closes crash leftovers. Never throws. */
  boot(): Promise<void>;
  joined(roomId: string, userId: string, at: Date): Promise<void>;
  left(roomId: string, userId: string, at: Date): Promise<void>;
  /** True once this month's minutes reach `VOICE_MONTHLY_CAP_MINUTES`: new tokens are refused. */
  isResting(): boolean;
  monthMinutes(): number;
};

export function createVoiceMeter({
  store,
  capMinutes,
  log,
  now = Date.now,
}: {
  readonly store: VoiceUsageStore;
  readonly capMinutes: number | null;
  readonly log: Logger;
  readonly now?: () => number;
}): VoiceMeter {
  let month = monthStartUtc(now()).getTime();
  let total = 0;

  /** A new month starts from zero without waiting for a restart. */
  const rollMonth = () => {
    const current = monthStartUtc(now()).getTime();
    if (current !== month) {
      month = current;
      total = 0;
    }
  };

  // Metering must never break voice or the game: a failed write is logged and voice goes on.
  const safely = async (event: string, write: () => Promise<void>) => {
    try {
      await write();
    } catch (error) {
      log.error({ event, err: error }, event);
    }
  };

  return {
    boot: () =>
      safely("voice_usage_boot_failed", async () => {
        await store.closeStale(new Date(now() - STALE_SESSION_MS));
        month = monthStartUtc(now()).getTime();
        total = await store.minutesSince(new Date(month));
      }),
    joined: (roomId, userId, at) =>
      safely("voice_usage_write_failed", () => store.open(roomId, userId, at)),
    left: (roomId, userId, at) =>
      safely("voice_usage_write_failed", async () => {
        const minutes = await store.close(roomId, userId, at);
        rollMonth();
        total += minutes;
      }),
    isResting() {
      rollMonth();
      return capMinutes !== null && total >= capMinutes;
    },
    monthMinutes() {
      rollMonth();
      return total;
    },
  };
}
