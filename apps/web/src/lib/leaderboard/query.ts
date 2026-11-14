import { schema, type Db } from "@heartroom/db";
import {
  and,
  between,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  ne,
  sum,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  bandRange,
  BOARD_SIZE,
  MIN_GAMES,
  MIN_OPPONENTS,
  periodStart,
  type LeaderboardFilters,
} from "./filters.ts";

export type LeaderboardRow = {
  readonly rank: number;
  /** The viewer's own row. User ids never leave the server, so the page can't key on them. */
  readonly isYou: boolean;
  readonly name: string;
  readonly played: number;
  /** Shared wins count as 1/k, so this can be fractional. */
  readonly wins: number;
  /** wins / played, 0…1. */
  readonly winRate: number;
};

/** The viewer's own standing: their row when they qualify, else how far they are from it. */
export type YourStanding =
  | { readonly kind: "ranked"; readonly row: LeaderboardRow }
  | {
      readonly kind: "unranked";
      readonly played: number;
      readonly opponents: number;
      readonly gamesNeeded: number;
      readonly opponentsNeeded: number;
    };

export type Leaderboard = {
  readonly rows: readonly LeaderboardRow[];
  /** Null when nobody is signed in with Google (guests never appear on a board). */
  readonly you: YourStanding | null;
};

type Tally = { userId: string; played: number; wins: number; opponents: number };

/**
 * Server-only. Ranked, finished games of one game in a window and player-count band; only Google
 * accounts appear. `ranked` was decided by the game server (classic settings, ≥2 signed-in players,
 * pair cap), so this never re-judges a game. Ordered by total wins, then win rate, then games.
 */
export async function readLeaderboard(
  db: Db,
  filters: LeaderboardFilters,
  viewerId: string | null,
  now: Date,
): Promise<Leaderboard> {
  const { matches, matchPlayers, user } = schema;
  const start = periodStart(filters.period, now);
  const band = bandRange(filters.players);
  const inBoard: SQL[] = [
    eq(matches.gameId, filters.game),
    eq(matches.ranked, true),
    eq(matches.status, "finished"),
    eq(user.isAnonymous, false),
  ];
  if (start !== null) inBoard.push(gte(matches.endedAt, start));
  if (band !== null) inBoard.push(between(matches.playerCount, band[0], band[1]));

  const totals = await db
    .select({
      userId: matchPlayers.userId,
      played: count(),
      wins: sum(matchPlayers.winShare).mapWith(Number),
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .innerJoin(user, eq(user.id, matchPlayers.userId))
    .where(and(...inBoard))
    .groupBy(matchPlayers.userId);

  // Different signed-in people played against: an alt account or one friend can't fill a board.
  const other = alias(matchPlayers, "other");
  const otherUser = alias(user, "other_user");
  const opponents = await db
    .select({ userId: matchPlayers.userId, opponents: countDistinct(other.userId) })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .innerJoin(user, eq(user.id, matchPlayers.userId))
    .innerJoin(
      other,
      and(eq(other.matchId, matchPlayers.matchId), ne(other.seat, matchPlayers.seat)),
    )
    .innerJoin(otherUser, eq(otherUser.id, other.userId))
    .where(
      and(
        ...inBoard,
        isNotNull(other.userId),
        ne(other.userId, matchPlayers.userId),
        eq(otherUser.isAnonymous, false),
      ),
    )
    .groupBy(matchPlayers.userId);

  const opponentsOf = new Map(opponents.map((o) => [o.userId, o.opponents]));
  const tallies: Tally[] = totals.flatMap((t) =>
    t.userId === null
      ? []
      : [
          {
            userId: t.userId,
            played: t.played,
            wins: t.wins,
            opponents: opponentsOf.get(t.userId) ?? 0,
          },
        ],
  );

  const qualified = tallies
    .filter((t) => t.played >= MIN_GAMES && t.opponents >= MIN_OPPONENTS)
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.wins / b.played - a.wins / a.played ||
        b.played - a.played ||
        a.userId.localeCompare(b.userId),
    );

  // Equal wins and win rate share a rank (1, 2, 2, 4).
  const ranks: number[] = [];
  qualified.forEach((t, i) => {
    const prev = qualified[i - 1];
    const tied = prev?.wins === t.wins && prev.wins / prev.played === t.wins / t.played;
    ranks.push(tied ? (ranks[i - 1] ?? i + 1) : i + 1);
  });

  const viewerIndex = viewerId === null ? -1 : qualified.findIndex((t) => t.userId === viewerId);
  const shown = qualified
    .slice(0, BOARD_SIZE)
    .map((t, i) => ({ tally: t, rank: ranks[i] ?? i + 1 }));
  const viewerQualified = viewerIndex >= 0 ? qualified[viewerIndex] : undefined;
  if (viewerQualified !== undefined && viewerIndex >= BOARD_SIZE)
    shown.push({ tally: viewerQualified, rank: ranks[viewerIndex] ?? viewerIndex + 1 });

  const names = await latestNicknames(
    db,
    shown.map((s) => s.tally.userId),
  );
  const toRow = ({ tally, rank }: { tally: Tally; rank: number }): LeaderboardRow => ({
    rank,
    isYou: tally.userId === viewerId,
    name: names.get(tally.userId) ?? "Player",
    played: tally.played,
    wins: tally.wins,
    winRate: tally.wins / tally.played,
  });
  const rows = shown.map(toRow);

  return { rows: rows.slice(0, BOARD_SIZE), you: await standingOf(db, viewerId, tallies, rows) };
}

async function standingOf(
  db: Db,
  viewerId: string | null,
  tallies: readonly Tally[],
  rows: readonly LeaderboardRow[],
): Promise<YourStanding | null> {
  if (viewerId === null) return null;
  const row = rows.find((r) => r.isYou);
  if (row !== undefined) return { kind: "ranked", row };
  const account = await db
    .select({ isAnonymous: schema.user.isAnonymous })
    .from(schema.user)
    .where(eq(schema.user.id, viewerId));
  // No account, or a guest: guests never appear on a board.
  if (account[0]?.isAnonymous !== false) return null;
  const tally = tallies.find((t) => t.userId === viewerId);
  const played = tally?.played ?? 0;
  const opponents = tally?.opponents ?? 0;
  return {
    kind: "unranked",
    played,
    opponents,
    gamesNeeded: Math.max(0, MIN_GAMES - played),
    opponentsNeeded: Math.max(0, MIN_OPPONENTS - opponents),
  };
}

/** The name each person last played under: there is no profile name, only room nicknames. */
async function latestNicknames(db: Db, userIds: readonly string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { matches, matchPlayers } = schema;
  const rows = await db
    .selectDistinctOn([matchPlayers.userId], {
      userId: matchPlayers.userId,
      nickname: matchPlayers.nickname,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .where(and(inArray(matchPlayers.userId, [...userIds]), isNotNull(matchPlayers.nickname)))
    .orderBy(matchPlayers.userId, desc(matches.endedAt));
  return new Map(
    rows.flatMap((r) => (r.userId === null || r.nickname === null ? [] : [[r.userId, r.nickname]])),
  );
}
