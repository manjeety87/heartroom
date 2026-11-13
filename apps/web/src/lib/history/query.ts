import { schema, type Db } from "@heartroom/db";
import { and, count, desc, eq, inArray, sum } from "drizzle-orm";
import { HISTORY_LIMIT, type OnlineHistory } from "./online.ts";

/** Server-only: one person's online games and per-game totals, read straight from Postgres. */
export async function readOnlineHistory(db: Db, userId: string): Promise<OnlineHistory> {
  const { matches, matchPlayers } = schema;

  const mine = await db
    .select({
      id: matches.id,
      gameId: matches.gameId,
      config: matches.config,
      endedAt: matches.endedAt,
      status: matches.status,
      ranked: matches.ranked,
      seat: matchPlayers.seat,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .where(eq(matchPlayers.userId, userId))
    .orderBy(desc(matches.endedAt))
    .limit(HISTORY_LIMIT);

  const everyone =
    mine.length === 0
      ? []
      : await db
          .select({
            matchId: matchPlayers.matchId,
            seat: matchPlayers.seat,
            nickname: matchPlayers.nickname,
            result: matchPlayers.result,
            winShare: matchPlayers.winShare,
          })
          .from(matchPlayers)
          .where(
            inArray(
              matchPlayers.matchId,
              mine.map((m) => m.id),
            ),
          );

  // Totals cover every finished game, not only the newest page.
  const totals = await db
    .select({
      gameId: matches.gameId,
      played: count(),
      wins: sum(matchPlayers.winShare).mapWith(Number),
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .where(and(eq(matchPlayers.userId, userId), eq(matches.status, "finished")))
    .groupBy(matches.gameId);

  return {
    stats: totals.map((t) => ({ gameId: t.gameId, played: t.played, wins: t.wins })),
    games: mine.map((m) => ({
      id: m.id,
      gameId: m.gameId,
      config: m.config,
      endedAt: m.endedAt.toISOString(),
      status: m.status,
      ranked: m.ranked,
      you: m.seat,
      players: everyone
        .filter((p) => p.matchId === m.id)
        .sort((a, b) => a.seat - b.seat)
        .map(({ seat, nickname, result, winShare }) => ({ seat, nickname, result, winShare })),
    })),
  };
}
