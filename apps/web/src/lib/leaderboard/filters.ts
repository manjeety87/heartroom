import { z } from "zod";

/**
 * What the leaderboard shows, read from the URL (`?game=bingo&period=week&players=2`). Anything
 * unknown falls back to the default, so an old or hand-edited link still opens a board.
 */

export const LEADERBOARD_GAMES = ["bingo", "word-guess"] as const;
export const PERIODS = ["week", "month", "all"] as const;
/** Player-count bands ("mode"). Word Guess is always 2 players, so it has no band. */
export const BANDS = ["any", "2", "3-4", "5-6"] as const;

export type LeaderboardGame = (typeof LEADERBOARD_GAMES)[number];
export type Period = (typeof PERIODS)[number];
export type Band = (typeof BANDS)[number];

export const leaderboardFiltersSchema = z.object({
  game: z.enum(LEADERBOARD_GAMES).catch("bingo"),
  period: z.enum(PERIODS).catch("month"),
  players: z.enum(BANDS).catch("any"),
});

export type LeaderboardFilters = z.infer<typeof leaderboardFiltersSchema>;

/** Next hands search params as string | string[] | undefined; the first value counts. */
export function parseFilters(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
): LeaderboardFilters {
  const first = (v: string | readonly string[] | undefined) => (typeof v === "string" ? v : v?.[0]);
  const filters = leaderboardFiltersSchema.parse({
    game: first(params["game"]),
    period: first(params["period"]),
    players: first(params["players"]),
  });
  return filters.game === "word-guess" ? { ...filters, players: "any" } : filters;
}

/** The URL for a board, leaving defaults out so links stay short. */
export function filtersHref(filters: LeaderboardFilters): string {
  const query = new URLSearchParams();
  if (filters.game !== "bingo") query.set("game", filters.game);
  if (filters.period !== "month") query.set("period", filters.period);
  if (filters.players !== "any" && filters.game === "bingo") query.set("players", filters.players);
  const text = query.toString();
  return text === "" ? "/leaderboard" : `/leaderboard?${text}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rolling windows, so a board never empties out on a Monday morning. */
export function periodStart(period: Period, now: Date): Date | null {
  if (period === "week") return new Date(now.getTime() - 7 * DAY_MS);
  if (period === "month") return new Date(now.getTime() - 30 * DAY_MS);
  return null;
}

export function bandRange(band: Band): readonly [number, number] | null {
  if (band === "2") return [2, 2];
  if (band === "3-4") return [3, 4];
  if (band === "5-6") return [5, 6];
  return null;
}

/** To appear on a board: enough ranked games, against enough different people (anti-farming). */
export const MIN_GAMES = 10;
export const MIN_OPPONENTS = 3;
export const BOARD_SIZE = 50;
