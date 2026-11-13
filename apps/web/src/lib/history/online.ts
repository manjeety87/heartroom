import { z } from "zod";

/**
 * The online games of the signed-in person (a guest or a Google account), as `/api/history` sends
 * them. Shared by the route (which builds it) and the History screen (which parses it).
 */

export const HISTORY_LIMIT = 50;

const result = z.enum(["win", "loss", "draw"]).nullable();

export const onlineGameSchema = z.object({
  id: z.uuid(),
  gameId: z.string(),
  config: z.unknown(),
  endedAt: z.iso.datetime({ offset: true }),
  status: z.enum(["finished", "abandoned"]),
  ranked: z.boolean(),
  /** The viewer's seat in `players`. */
  you: z.number().int().nonnegative(),
  players: z.array(
    z.object({
      seat: z.number().int().nonnegative(),
      nickname: z.string().nullable(),
      result,
      winShare: z.number(),
    }),
  ),
});

export const onlineHistorySchema = z.object({
  /** One row per game: finished games played and wins (a shared win counts 1/k). */
  stats: z.array(z.object({ gameId: z.string(), played: z.number().int(), wins: z.number() })),
  /** Newest first, at most `HISTORY_LIMIT`. */
  games: z.array(onlineGameSchema),
});

export type OnlineGame = z.infer<typeof onlineGameSchema>;
export type OnlineHistory = z.infer<typeof onlineHistorySchema>;

export const NO_HISTORY: OnlineHistory = { stats: [], games: [] };
