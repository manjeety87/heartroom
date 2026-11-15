import { schema, type Db } from "@heartroom/db";
import { and, isNotNull, lt } from "drizzle-orm";
import type { Logger } from "../logger.ts";

/** A finished game's move list is kept this long (design doc › Data model); results stay forever. */
export const ACTIONS_KEPT_DAYS = 30;
const DAY_MS = 24 * 60 * 60_000;

/** Empties `matches.actions` for games that ended more than 30 days before `now`. Returns how many. */
export async function clearOldActions(db: Db, now: Date): Promise<number> {
  const before = new Date(now.getTime() - ACTIONS_KEPT_DAYS * DAY_MS);
  const cleared = await db
    .update(schema.matches)
    .set({ actions: null })
    .where(and(lt(schema.matches.endedAt, before), isNotNull(schema.matches.actions)))
    .returning({ id: schema.matches.id });
  return cleared.length;
}

/**
 * Runs `clearOldActions` once a minute after boot (not during it) and then daily. One process holds
 * every room, so no lock is needed; a failed run is logged and the next one catches up.
 */
export function scheduleRetention(db: Db, log: Logger): { stop(): void } {
  const run = () => {
    clearOldActions(db, new Date())
      .then((count) => {
        if (count > 0) log.info({ event: "actions_cleared", count }, "actions_cleared");
      })
      .catch((error: unknown) => {
        log.error({ event: "actions_clear_failed", err: error }, "actions_clear_failed");
      });
  };
  const first = setTimeout(run, 60_000);
  const daily = setInterval(run, DAY_MS);
  // Neither timer should keep the process alive on shutdown.
  first.unref();
  daily.unref();
  return {
    stop() {
      clearTimeout(first);
      clearInterval(daily);
    },
  };
}
