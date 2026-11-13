import type { MatchResult } from "@heartroom/engine";
import { schema, type Db } from "@heartroom/db";
import { aliasedTable, and, count, eq, gte, inArray, lt } from "drizzle-orm";
import {
  autoPlayedTurns,
  isRankEligible,
  kolkataDayStart,
  PAIR_CAP_PER_DAY,
  pairsOf,
  seatOutcomes,
} from "./ranking.ts";

/**
 * What the game server keeps in Postgres. Rooms talk to this interface, never to the database, and
 * keep running if a write fails: game sync never waits on the database (backend.md › Database).
 */
export type RoomStore = {
  /** Writes `matches` + `match_players` once; a repeated id is a no-op. */
  recordMatch(match: MatchToRecord): Promise<void>;
  isMatchRecorded(matchId: string): Promise<boolean>;
  recordRoomEvent(
    roomId: string,
    type: RoomEventType,
    data?: Record<string, unknown>,
  ): Promise<void>;
  /** True when the room was closed on purpose, so a crash checkpoint must not bring it back. */
  isRoomClosed(roomId: string): Promise<boolean>;
};

export type RoomEventType = "created" | "closed" | "restored" | "kicked";

export type MatchToRecord = {
  readonly id: string;
  readonly gameId: string;
  readonly moduleVersion: number;
  readonly config: unknown;
  /** From the game module: may this config count towards rankings at all? */
  readonly configIsRanked: boolean;
  readonly seed: Uint8Array;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly status: "finished" | "abandoned";
  /** userId per game seat. */
  readonly users: readonly string[];
  readonly result: MatchResult | null;
  readonly actions: readonly { readonly seat: number; readonly by: "player" | "server" }[];
};

export function createDbStore(db: Db): RoomStore {
  return {
    async recordMatch(match) {
      await db.transaction(async (tx) => {
        const accounts = await tx
          .select({ id: schema.user.id, isAnonymous: schema.user.isAnonymous })
          .from(schema.user)
          .where(inArray(schema.user.id, [...match.users]));
        const known = new Set(accounts.map((a) => a.id));
        const signedIn = accounts.filter((a) => !a.isAnonymous).map((a) => a.id);

        const isEligible = isRankEligible({
          status: match.status,
          configIsRanked: match.configIsRanked,
          signedInPlayers: new Set(signedIn).size,
          autoPlayed: autoPlayedTurns(match.users.length, match.actions),
        });
        const ranked = isEligible && (await underPairCap(tx, signedIn, match.endedAt));

        const inserted = await tx
          .insert(schema.matches)
          .values({
            id: match.id,
            gameId: match.gameId,
            moduleVersion: match.moduleVersion,
            config: match.config,
            seed: match.seed,
            startedAt: match.startedAt,
            endedAt: match.endedAt,
            status: match.status,
            ranked,
            playerCount: match.users.length,
            actions: match.actions,
          })
          .onConflictDoNothing()
          .returning({ id: schema.matches.id });
        if (inserted.length === 0) return; // Already written (a retried write).

        const outcomes = seatOutcomes(match.users.length, match.result);
        await tx.insert(schema.matchPlayers).values(
          match.users.map((userId, seat) => ({
            matchId: match.id,
            // Development identities ("dev-…") have no account row.
            userId: known.has(userId) ? userId : null,
            seat,
            result: outcomes[seat]?.result ?? null,
            placement: outcomes[seat]?.placement ?? null,
            winShare: outcomes[seat]?.winShare ?? 0,
          })),
        );
      });
    },

    async isMatchRecorded(matchId) {
      const rows = await db
        .select({ id: schema.matches.id })
        .from(schema.matches)
        .where(eq(schema.matches.id, matchId))
        .limit(1);
      return rows.length > 0;
    },

    async recordRoomEvent(roomId, type, data) {
      await db.insert(schema.roomEvents).values({ roomId, type, data: data ?? null });
    },

    async isRoomClosed(roomId) {
      const rows = await db
        .select({ id: schema.roomEvents.id })
        .from(schema.roomEvents)
        .where(and(eq(schema.roomEvents.roomId, roomId), eq(schema.roomEvents.type, "closed")))
        .limit(1);
      return rows.length > 0;
    },
  };
}

/**
 * The pair cap (design doc › Leaderboard): no two signed-in players may count more than
 * `PAIR_CAP_PER_DAY` ranked games together in one Asia/Kolkata day, so friends can't farm wins.
 */
async function underPairCap(tx: Db, signedIn: readonly string[], endedAt: Date): Promise<boolean> {
  const pairs = pairsOf(signedIn);
  if (pairs.length === 0) return true;
  const a = aliasedTable(schema.matchPlayers, "a");
  const b = aliasedTable(schema.matchPlayers, "b");
  const rows = await tx
    .select({ first: a.userId, second: b.userId, games: count() })
    .from(schema.matches)
    .innerJoin(a, eq(a.matchId, schema.matches.id))
    .innerJoin(b, eq(b.matchId, schema.matches.id))
    .where(
      and(
        eq(schema.matches.ranked, true),
        gte(schema.matches.endedAt, kolkataDayStart(endedAt)),
        inArray(a.userId, [...signedIn]),
        inArray(b.userId, [...signedIn]),
        lt(a.userId, b.userId),
      ),
    )
    .groupBy(a.userId, b.userId);
  return rows.every((row) => row.games < PAIR_CAP_PER_DAY);
}
