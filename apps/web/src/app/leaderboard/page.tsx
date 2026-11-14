import type { Metadata } from "next";
import { headers } from "next/headers";
import { FilterBar } from "@/features/leaderboard/FilterBar";
import { LeaderboardTable } from "@/features/leaderboard/LeaderboardTable";
import { getAuth, getDb } from "@/lib/auth/server";
import { parseFilters } from "@/lib/leaderboard/filters";
import { readLeaderboard } from "@/lib/leaderboard/query";

export const metadata: Metadata = { title: "Leaderboard" };

/**
 * Rendered on the server per request: the board is a query over ranked games, and the viewer's
 * own row depends on who is asking. A failed read falls to the app's error screen (Try again).
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const session = await getAuth().api.getSession({ headers: await headers() });
  const board = await readLeaderboard(getDb(), filters, session?.user.id ?? null, new Date());
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-gutter py-6">
      <div>
        <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">Leaderboard</h1>
        <p className="text-small text-pencil">Total wins in ranked games, then win rate.</p>
      </div>
      <FilterBar filters={filters}>
        <LeaderboardTable board={board} />
      </FilterBar>
    </main>
  );
}
