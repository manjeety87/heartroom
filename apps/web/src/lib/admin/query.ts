import { schema, type Db } from "@heartroom/db";
import { and, count, desc, eq, gte, isNotNull, isNull, sql, sum } from "drizzle-orm";
import { latestNicknames } from "@/lib/leaderboard/query";

export type GameTotals = {
  readonly gameId: string;
  readonly last7Days: number;
  readonly last30Days: number;
  readonly total: number;
  readonly abandoned: number;
  /** abandoned / total, 0…1. */
  readonly abandonedRate: number;
};

export type Winner = {
  readonly name: string;
  readonly isGuest: boolean;
  readonly played: number;
  /** Shared wins count as 1/k. */
  readonly wins: number;
};

export type AdminStats = {
  readonly games: readonly GameTotals[];
  /** Per game, the people with the most wins in finished games (ranked or not). */
  readonly winners: readonly { readonly gameId: string; readonly rows: readonly Winner[] }[];
  readonly voice: { readonly monthMinutes: number; readonly openSessions: number };
  /** Room events in the last 24 hours. */
  readonly rooms24h: {
    readonly created: number;
    readonly closedByAdmin: number;
    readonly kicked: number;
  };
};

const DAY = 24 * 60 * 60_000;
export const WINNERS_PER_GAME = 10;

/** Server-only. Totals over every game ever written; nothing here needs to be live. */
export async function readAdminStats(db: Db, now: Date): Promise<AdminStats> {
  const { matches, voiceUsage, roomEvents } = schema;
  const since = (days: number) => new Date(now.getTime() - days * DAY);
  const countWhere = (condition: ReturnType<typeof sql>) =>
    sql<number>`count(*) filter (where ${condition})`.mapWith(Number);

  const totals = await db
    .select({
      gameId: matches.gameId,
      total: count(),
      // Raw SQL gets no column mapping, and postgres.js refuses a Date there: send the ISO string.
      last7Days: countWhere(sql`${matches.endedAt} >= ${since(7).toISOString()}`),
      last30Days: countWhere(sql`${matches.endedAt} >= ${since(30).toISOString()}`),
      abandoned: countWhere(sql`${matches.status} = 'abandoned'`),
    })
    .from(matches)
    .groupBy(matches.gameId)
    .orderBy(desc(count()), matches.gameId);

  // One game at a time: the local database (PGlite behind one socket) mixes up parallel queries.
  const winners: { gameId: string; rows: readonly Winner[] }[] = [];
  for (const { gameId } of totals) winners.push({ gameId, rows: await readWinners(db, gameId) });

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [voiceMonth] = await db
    .select({ minutes: sum(voiceUsage.minutes).mapWith(Number) })
    .from(voiceUsage)
    .where(and(gte(voiceUsage.joinedAt, monthStart), isNotNull(voiceUsage.minutes)));
  const [open] = await db
    .select({ sessions: count() })
    .from(voiceUsage)
    .where(isNull(voiceUsage.leftAt));

  const reason = sql<string | null>`${roomEvents.data} ->> 'reason'`;
  const events = await db
    .select({ type: roomEvents.type, reason, n: count() })
    .from(roomEvents)
    .where(gte(roomEvents.at, since(1)))
    .groupBy(roomEvents.type, reason);
  const eventCount = (type: string, why?: string) =>
    events
      .filter((e) => e.type === type && (why === undefined || e.reason === why))
      .reduce((n, e) => n + e.n, 0);

  return {
    games: totals.map((t) => ({ ...t, abandonedRate: t.total === 0 ? 0 : t.abandoned / t.total })),
    winners,
    voice: { monthMinutes: voiceMonth?.minutes ?? 0, openSessions: open?.sessions ?? 0 },
    rooms24h: {
      created: eventCount("created"),
      closedByAdmin: eventCount("closed", "admin"),
      kicked: eventCount("kicked"),
    },
  };
}

/** The people with the most wins in one game's finished games, named by their last nickname. */
async function readWinners(db: Db, gameId: string): Promise<Winner[]> {
  const { matches, matchPlayers, user } = schema;
  const wins = sum(matchPlayers.winShare).mapWith(Number);
  const rows = await db
    .select({ userId: user.id, isGuest: user.isAnonymous, played: count(), wins })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .innerJoin(user, eq(user.id, matchPlayers.userId))
    .where(and(eq(matches.gameId, gameId), eq(matches.status, "finished")))
    .groupBy(user.id, user.isAnonymous)
    .orderBy(desc(wins), desc(count()), user.id)
    .limit(WINNERS_PER_GAME);
  const names = await latestNicknames(
    db,
    rows.map((r) => r.userId),
  );
  return rows.map((r) => ({
    name: names.get(r.userId) ?? "Player",
    isGuest: r.isGuest,
    played: r.played,
    wins: r.wins,
  }));
}
