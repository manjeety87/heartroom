import type { BingoPublicView } from "../view.ts";
import type { Mark } from "./BingoBoard.tsx";
import { LineProgress } from "./LineProgress.tsx";

/** How a seat is shown: its name and its colour (any CSS colour, usually a seat token). */
export type Player = { readonly name: string; readonly color: string };

export const playerAt = (players: readonly Player[], seat: number): Player =>
  players[seat] ?? { name: `Seat ${String(seat + 1)}`, color: "var(--color-pencil)" };

/** Every called number, inked in its caller's colour; the viewer's own calls are heavier. */
export function marksFor(
  view: Pick<BingoPublicView, "called" | "callers">,
  players: readonly Player[],
  you: number | null,
): Map<number, Mark> {
  const marks = new Map<number, Mark>();
  view.called.forEach((n, i) => {
    const seat = view.callers[i] ?? -1;
    const player = playerAt(players, seat);
    marks.set(n, {
      color: player.color,
      isHeavy: seat === you,
      by: seat === you ? "you" : player.name,
    });
  });
  return marks;
}

/** A player's colour dot: the key that ties a name to the ink of the numbers they call. */
export function PlayerDot({
  color,
  isLarge = false,
}: {
  readonly color: string;
  readonly isLarge?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-pill ${isLarge ? "size-3.5" : "size-2.5"}`}
      style={{ backgroundColor: color }}
    />
  );
}

/** Everyone in the game: colour, name, progress, and whose turn it is. */
export function PlayersBar({
  view,
  players,
  you,
}: {
  readonly view: BingoPublicView;
  readonly players: readonly Player[];
  readonly you: number | null;
}) {
  const seats = Array.from({ length: view.seats }, (_, s) => s);
  return (
    <ul aria-label="Players" className="flex flex-wrap justify-center gap-2">
      {seats.map((seat) => {
        const player = playerAt(players, seat);
        const isTurn = view.phase === "playing" && view.turn === seat;
        return (
          <li
            key={seat}
            aria-current={isTurn ? "step" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-pill py-1 pr-3 pl-2.5 transition-[background-color,box-shadow] duration-(--duration-popover) ease-out ${
              isTurn ? "bg-sheet shadow-float ring-2" : "bg-well"
            }`}
            style={isTurn ? { ["--tw-ring-color" as string]: player.color } : undefined}
          >
            <PlayerDot color={player.color} isLarge />
            <span className="max-w-32 truncate text-small font-semibold text-ink">
              {player.name}
              {seat === you && <span className="sr-only"> (you)</span>}
            </span>
            {view.phase === "setup" ? (
              <span className="text-caption text-pencil">
                {view.ready[seat] ? "Ready" : "Setting up…"}
              </span>
            ) : (
              <LineProgress
                count={view.lineCounts[seat] ?? 0}
                linesToWin={view.linesToWin}
                isCompact
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Every call in order, in the caller's colour: the record of who called what. */
export function CallLog({
  view,
  players,
  you,
}: {
  readonly view: Pick<BingoPublicView, "called" | "callers">;
  readonly players: readonly Player[];
  readonly you: number | null;
}) {
  if (view.called.length === 0) return null;
  return (
    <details className="group rounded-card bg-sheet p-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-tile px-1 text-small font-semibold text-ink focus-visible:outline-2 focus-visible:outline-pen">
        Calls so far · {view.called.length}
        <span
          aria-hidden
          className="text-pencil transition-transform duration-(--duration-popover) ease-out group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <ol className="mt-2 flex flex-wrap gap-1.5">
        {view.called.map((n, i) => {
          const seat = view.callers[i] ?? -1;
          const player = playerAt(players, seat);
          const by = seat === you ? "you" : player.name;
          return (
            <li
              key={n}
              title={`Call ${String(i + 1)}: ${String(n)} by ${by}`}
              className="grid size-9 place-items-center rounded-pill border-2 font-display text-small font-bold tabular-nums text-ink"
              style={{ borderColor: player.color }}
            >
              <span className="sr-only">{`Call ${String(i + 1)}: `}</span>
              {n}
              <span className="sr-only">{` by ${by}`}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
