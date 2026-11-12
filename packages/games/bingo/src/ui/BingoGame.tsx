import { createRng, newSeed } from "@heartroom/engine";
import { fillGrid } from "../bot.ts";
import type { BingoAction } from "../rules.ts";
import type { BingoSeatView, BingoView } from "../view.ts";
import { BingoBoard } from "./BingoBoard.tsx";
import { LineProgress } from "./LineProgress.tsx";
import { ResultsReveal } from "./ResultsReveal.tsx";
import { SetupBar } from "./SetupBar.tsx";

export type BingoGameProps = {
  readonly view: BingoView;
  /** Display name per seat; the viewer's own seat is usually "You". */
  readonly names: readonly string[];
  /** Every move goes out through here; whoever runs the match decides if it is allowed. */
  readonly onIntent: (action: BingoAction) => void;
  /** Extra status under the board, e.g. "Computer is thinking…". */
  readonly status?: string;
  readonly onRematch?: () => void;
};

/**
 * The whole Bingo screen for one viewer. It renders a view and emits intents, so the same
 * component serves vs Computer (a local match) and online play (the room).
 */
export function BingoGame({ view, names, onIntent, status, onRematch }: BingoGameProps) {
  const nameOf = (seat: number) => names[seat] ?? `Seat ${String(seat + 1)}`;
  if (view.phase === "done")
    return <ResultsReveal view={view} names={names} {...(onRematch ? { onRematch } : {})} />;

  const lastIndex = view.called.length - 1;
  const last = view.called[lastIndex];
  const lastBy = view.callers[lastIndex];
  const announcement =
    last === undefined || lastBy === undefined ? "" : `${nameOf(lastBy)} called ${String(last)}`;

  return (
    <div className="flex flex-col gap-4">
      <Opponents view={view} nameOf={nameOf} />
      <p
        aria-live="polite"
        className="min-h-8 text-center font-display text-title font-bold text-ink"
      >
        {announcement}
      </p>
      {view.kind === "seat" ? (
        <SeatArea view={view} nameOf={nameOf} onIntent={onIntent} />
      ) : (
        <p className="text-center text-pencil">You’re watching. Grids are revealed at the end.</p>
      )}
      {status && <p className="text-center text-small text-pencil">{status}</p>}
    </div>
  );
}

function Opponents({
  view,
  nameOf,
}: {
  readonly view: BingoView;
  readonly nameOf: (seat: number) => string;
}) {
  const you = view.kind === "seat" ? view.you : -1;
  const others = Array.from({ length: view.seats }, (_, s) => s).filter((s) => s !== you);
  return (
    <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
      {others.map((seat) => (
        <li key={seat} className="flex items-center gap-2 text-small text-ink">
          <span
            className={view.turn === seat && view.phase === "playing" ? "font-bold text-pen" : ""}
          >
            {nameOf(seat)}
          </span>
          {view.phase === "setup" ? (
            <span className="text-pencil">{view.ready[seat] ? "ready" : "setting up…"}</span>
          ) : (
            <LineProgress
              count={view.lineCounts[seat] ?? 0}
              linesToWin={view.linesToWin}
              isCompact
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function SeatArea({
  view,
  nameOf,
  onIntent,
}: {
  readonly view: BingoSeatView;
  readonly nameOf: (seat: number) => string;
  readonly onIntent: (action: BingoAction) => void;
}) {
  const isSetup = view.phase === "setup" && !view.ready[view.you];
  const isMyTurn = view.phase === "playing" && view.turn === view.you;
  const called = new Set(view.called);
  const placed = new Set(view.grid.filter((n): n is number => n !== null));
  const nextNumber =
    Array.from({ length: view.grid.length }, (_, i) => i + 1).find((n) => !placed.has(n)) ?? null;

  const onCellPress = (cell: number) => {
    const n = view.grid[cell] ?? null;
    if (isSetup && n === null && nextNumber !== null)
      onIntent({ type: "place", cell, n: nextNumber });
    if (isMyTurn && n !== null && !called.has(n)) onIntent({ type: "call", n });
  };
  const canPress = (cell: number) => {
    const n = view.grid[cell] ?? null;
    return isSetup ? n === null : isMyTurn && n !== null && !called.has(n);
  };

  const turnText =
    view.phase === "setup"
      ? isSetup
        ? null
        : "Waiting for everyone to get ready…"
      : isMyTurn
        ? "Your turn — tap a number to call it"
        : `${nameOf(view.turn ?? 0)}’s turn`;

  return (
    <>
      <div className="flex justify-center">
        <LineProgress count={view.yourLines.length} linesToWin={view.linesToWin} />
      </div>
      <BingoBoard
        size={view.size}
        grid={view.grid}
        called={view.called}
        lines={view.yourLines}
        label="Your grid"
        isActive={isMyTurn}
        {...(isSetup || isMyTurn ? { onCellPress, canPress } : {})}
      />
      {turnText && (
        <p
          className={`text-center text-body ${isMyTurn ? "font-semibold text-pen" : "text-pencil"}`}
        >
          {turnText}
        </p>
      )}
      {isSetup && (
        <SetupBar
          nextNumber={nextNumber}
          isFull={nextNumber === null}
          isEmpty={placed.size === 0}
          onShuffle={() => {
            onIntent({ type: "fill", grid: shuffledGrid(view.grid, view.size) });
          }}
          onClear={() => {
            onIntent({ type: "clear" });
          }}
          onReady={() => {
            onIntent({ type: "ready" });
          }}
        />
      )}
    </>
  );
}

/**
 * Shuffle keeps the numbers the player already tapped in and fills the rest at random; on a full
 * grid it reshuffles everything. The player's own grid, so local randomness is fine.
 */
function shuffledGrid(grid: readonly (number | null)[], size: number): number[] {
  const rng = createRng(newSeed());
  if (!grid.includes(null)) return fillGrid(size, rng);
  const placed = new Set(grid);
  const missing = rng.shuffle(fillGrid(size, rng).filter((n) => !placed.has(n)));
  return grid.map((n) => n ?? (missing.pop() as number));
}
