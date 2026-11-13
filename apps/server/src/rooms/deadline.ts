import type { Deadline } from "@heartroom/engine";

/**
 * The room's memory of the current deadline's clock. Rules give `at` relative to when a `key` first
 * appeared; the room supplies the time. For an `onlyWhenAway` deadline only time the seat spent away
 * counts, so a player who stays connected is never hurried.
 */
export type DeadlineClock = {
  readonly key: string;
  readonly startedAt: number;
  /** Away time already banked for this key. */
  readonly awayMs: number;
  /** When the seat went away, if it is away now. */
  readonly awaySince: number | null;
};

/** Starts a new clock when the key changes; otherwise keeps it, banking away time on a change. */
export function trackDeadline(
  clock: DeadlineClock | null,
  deadline: Deadline | null,
  now: number,
  isSeatAway: boolean,
): DeadlineClock | null {
  if (deadline === null) return null;
  if (clock?.key !== deadline.key) {
    return { key: deadline.key, startedAt: now, awayMs: 0, awaySince: isSeatAway ? now : null };
  }
  if (isSeatAway && clock.awaySince === null) return { ...clock, awaySince: now };
  if (!isSeatAway && clock.awaySince !== null) {
    return { ...clock, awayMs: clock.awayMs + (now - clock.awaySince), awaySince: null };
  }
  return clock;
}

/** Milliseconds until the deadline is due (≤ 0 means now), or null while its clock is paused. */
export function msUntilDue(clock: DeadlineClock, deadline: Deadline, now: number): number | null {
  if (deadline.onlyWhenAway !== true) return clock.startedAt + deadline.at - now;
  if (clock.awaySince === null) return null;
  return deadline.at - (clock.awayMs + (now - clock.awaySince));
}
