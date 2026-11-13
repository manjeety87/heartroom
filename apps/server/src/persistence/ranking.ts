import type { MatchResult } from "@heartroom/engine";

/**
 * Stats rules, decided by the server when a match is written (design doc › Data model, Leaderboard).
 * Pure, so every rule is unit-tested; `store.ts` feeds them what the database knows.
 */

/** A seat played by the server on more of its turns than this makes the match unranked. */
export const MAX_AUTO_PLAYED_TURNS = 2;
/** Ranked games any two signed-in players may count together per (Asia/Kolkata) day. */
export const PAIR_CAP_PER_DAY = 10;
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 24 * 60 * 60_000;

export type SeatOutcome = {
  readonly result: "win" | "loss" | "draw" | null;
  readonly placement: number | null;
  /** 1/k for a win shared by k players, 1 for a sole win, 0 otherwise. */
  readonly winShare: number;
};

/** Per seat: an abandoned match (`result` null) has no winners and gives nobody a share. */
export function seatOutcomes(seats: number, result: MatchResult | null): SeatOutcome[] {
  return Array.from({ length: seats }, (_, seat) => {
    if (result === null) return { result: null, placement: null, winShare: 0 };
    const placement = result.placements[seat] ?? null;
    if (result.winners.length === 0) return { result: "draw", placement, winShare: 0 };
    const isWinner = result.winners.includes(seat);
    return {
      result: isWinner ? "win" : "loss",
      placement,
      winShare: isWinner ? 1 / result.winners.length : 0,
    };
  });
}

/** How many times the server played each seat (its deadline passed while the player was away). */
export function autoPlayedTurns(
  seats: number,
  actions: readonly { readonly seat: number; readonly by: "player" | "server" }[],
): number[] {
  const counts = Array.from({ length: seats }, () => 0);
  for (const { seat, by } of actions) {
    if (by === "server" && seat < seats) counts[seat] = (counts[seat] ?? 0) + 1;
  }
  return counts;
}

/**
 * Everything but the pair cap: a finished game in a ranked config, at least two signed-in (not
 * guest) players, and no seat mostly played by the server.
 */
export function isRankEligible(input: {
  readonly status: "finished" | "abandoned";
  readonly configIsRanked: boolean;
  readonly signedInPlayers: number;
  readonly autoPlayed: readonly number[];
}): boolean {
  return (
    input.status === "finished" &&
    input.configIsRanked &&
    input.signedInPlayers >= 2 &&
    input.autoPlayed.every((turns) => turns <= MAX_AUTO_PLAYED_TURNS)
  );
}

/** Midnight of `now`'s calendar day in India (UTC+5:30, no daylight saving), as a UTC instant. */
export function kolkataDayStart(now: Date): Date {
  const local = now.getTime() + IST_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - IST_OFFSET_MS);
}

/** Every unordered pair of distinct ids, smaller id first (how the pair-count query reports them). */
export function pairsOf(ids: readonly string[]): [string, string][] {
  const sorted = [...new Set(ids)].sort();
  return sorted.flatMap((first, i) =>
    sorted.slice(i + 1).map((second): [string, string] => [first, second]),
  );
}
