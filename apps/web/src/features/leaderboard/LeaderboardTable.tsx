import Link from "next/link";
import { MIN_GAMES, MIN_OPPONENTS } from "@/lib/leaderboard/filters";
import type { Leaderboard, LeaderboardRow, YourStanding } from "@/lib/leaderboard/query";

/** Shared wins make halves and thirds: one decimal at most, none when whole. */
const formatWins = (wins: number) =>
  Number.isInteger(wins) ? String(wins) : wins.toFixed(1).replace(/\.0$/, "");
const formatRate = (rate: number) => `${String(Math.round(rate * 100))}%`;

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/**
 * The board, rendered on the server. Your own standing sticks to the bottom of the screen, so you
 * can always see where you are without scrolling a long list.
 */
export function LeaderboardTable({ board }: { readonly board: Leaderboard }) {
  return (
    <div className="flex flex-col gap-4">
      {board.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-card bg-sheet px-4 py-10 text-center">
          <p className="text-body font-semibold text-ink">Nobody here yet</p>
          <p className="max-w-sm text-small text-pencil">
            A player shows up after {MIN_GAMES} ranked games against {MIN_OPPONENTS} or more
            different people.
          </p>
        </div>
      ) : (
        <table className="w-full border-separate border-spacing-y-1 text-left">
          <caption className="sr-only">Leaderboard</caption>
          <thead>
            <tr className="text-caption text-pencil">
              <th scope="col" className="w-10 px-2 font-semibold">
                #
              </th>
              <th scope="col" className="px-2 font-semibold">
                Player
              </th>
              <th scope="col" className="px-2 text-right font-semibold">
                Wins
              </th>
              <th scope="col" className="px-2 text-right font-semibold">
                Win rate
              </th>
              <th scope="col" className="hidden px-2 text-right font-semibold sm:table-cell">
                Games
              </th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((row, i) => (
              <Row key={i} row={row} />
            ))}
          </tbody>
        </table>
      )}
      <p className="text-caption text-pencil">
        Only ranked games count: classic settings, two or more players signed in with Google. A
        shared win counts as a part (½ for two winners).
      </p>
      <YourBar you={board.you} />
    </div>
  );
}

function Row({ row }: { readonly row: LeaderboardRow }) {
  const isYou = row.isYou;
  const cell = "px-2 py-2.5 tabular-nums";
  return (
    <tr
      aria-current={isYou ? "true" : undefined}
      className={`text-body ${isYou ? "bg-well font-semibold text-ink" : "bg-sheet text-ink"}`}
    >
      <td className={`${cell} rounded-l-tile text-pencil`}>{row.rank}</td>
      <td className={`${cell} max-w-0 truncate`}>
        {row.name}
        {isYou && <span className="text-pencil"> (you)</span>}
      </td>
      <td className={`${cell} text-right`}>{formatWins(row.wins)}</td>
      <td className={`${cell} rounded-r-tile text-right sm:rounded-r-none`}>
        {formatRate(row.winRate)}
      </td>
      <td className={`${cell} hidden rounded-r-tile text-right text-pencil sm:table-cell`}>
        {row.played}
      </td>
    </tr>
  );
}

function YourBar({ you }: { readonly you: YourStanding | null }) {
  let text: string;
  if (you === null) text = "Sign in with Google to get on the board.";
  else if (you.kind === "ranked")
    text = `You’re #${String(you.row.rank)} · ${formatWins(you.row.wins)} wins · ${formatRate(you.row.winRate)}`;
  else {
    const needs = [
      you.gamesNeeded > 0 ? plural(you.gamesNeeded, "more ranked game", "more ranked games") : null,
      you.opponentsNeeded > 0
        ? plural(you.opponentsNeeded, "more different opponent", "more different opponents")
        : null,
    ].filter((n) => n !== null);
    text = `Not on the board yet: ${needs.join(" and ")} to go.`;
  }
  return (
    <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom,0px))] flex flex-wrap items-center justify-between gap-2 rounded-card bg-sheet px-4 py-3 shadow-float">
      <p aria-live="polite" className="text-small font-semibold text-ink">
        {text}
      </p>
      {you === null && (
        <Link
          href="/settings"
          className="inline-flex min-h-11 items-center rounded-pill bg-pen px-4 text-small font-semibold text-on-pen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
