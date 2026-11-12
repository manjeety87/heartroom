import { useState } from "react";
import { Button } from "@heartroom/ui";
import { createRng, newSeed } from "@heartroom/engine";
import { fillGrid } from "../bot.ts";
import type { BingoAction } from "../rules.ts";
import type { BingoSeatView, BingoView } from "../view.ts";
import { BingoBoard } from "./BingoBoard.tsx";
import { LineProgress } from "./LineProgress.tsx";
import { CallLog, marksFor, playerAt, PlayerDot, PlayersBar, type Player } from "./players.tsx";
import { ResultsReveal } from "./ResultsReveal.tsx";
import { SetupBar } from "./SetupBar.tsx";

export type BingoGameProps = {
  readonly view: BingoView;
  /** Name and colour per seat; the viewer's own seat is usually named "You". */
  readonly players: readonly Player[];
  /** Every move goes out through here; whoever runs the match decides if it is allowed. */
  readonly onIntent: (action: BingoAction) => void;
  /** Extra status under the board, e.g. "Computer is thinking…". */
  readonly status?: string;
  readonly onRematch?: () => void;
};

/** From this size up, cells are below the 44 px target on phones, so a call takes two taps. */
export const CONFIRM_FROM_SIZE = 7;

/**
 * The whole Bingo screen for one viewer. It renders a view and emits intents, so the same
 * component serves vs Computer (a local match) and online play (the room).
 */
export function BingoGame({ view, players, onIntent, status, onRematch }: BingoGameProps) {
  const you = view.kind === "seat" ? view.you : null;
  if (view.phase === "done") {
    return (
      <ResultsReveal
        view={view}
        players={players}
        you={you}
        {...(onRematch ? { onRematch } : {})}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <PlayersBar view={view} players={players} you={you} />
      <Stage view={view} players={players} you={you} />
      {view.kind === "seat" ? (
        <SeatArea view={view} players={players} onIntent={onIntent} />
      ) : (
        <p className="text-center text-pencil">You’re watching. Grids are revealed at the end.</p>
      )}
      {status && (
        <p aria-live="polite" className="text-center text-small text-pencil">
          {status}
        </p>
      )}
      <CallLog view={view} players={players} you={you} />
    </div>
  );
}

/** The last call, large, in its caller's colour — the one thing everyone looks at between turns. */
function Stage({
  view,
  players,
  you,
}: {
  readonly view: BingoView;
  readonly players: readonly Player[];
  readonly you: number | null;
}) {
  const index = view.called.length - 1;
  const n = view.called[index];
  const by = view.callers[index];
  if (n === undefined || by === undefined) {
    return (
      <p className="min-h-20 content-center text-center text-body text-pencil">
        {view.phase === "setup" ? "Fill your grid, then tap Ready." : "No numbers called yet."}
      </p>
    );
  }
  const caller = playerAt(players, by);
  const name = by === you ? "You" : caller.name;
  return (
    <div aria-live="polite" className="flex min-h-20 items-center justify-center gap-4">
      <span
        key={n}
        aria-hidden
        className="grid size-16 animate-stamp place-items-center rounded-pill border-4 font-display text-h2 font-extrabold tabular-nums text-ink motion-reduce:animate-fade-in"
        style={{ borderColor: caller.color }}
      >
        {n}
      </span>
      <span className="flex flex-col">
        <span className="flex items-center gap-2 text-small text-pencil">
          <PlayerDot color={caller.color} />
          {name} called
        </span>
        <span className="font-display text-title font-bold text-ink">
          {n}
          <span className="sr-only">{`, call ${String(index + 1)}`}</span>
        </span>
      </span>
    </div>
  );
}

function SeatArea({
  view,
  players,
  onIntent,
}: {
  readonly view: BingoSeatView;
  readonly players: readonly Player[];
  readonly onIntent: (action: BingoAction) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const isSetup = view.phase === "setup" && !view.ready[view.you];
  const isMyTurn = view.phase === "playing" && view.turn === view.you;
  const needsConfirm = view.size >= CONFIRM_FROM_SIZE;
  const called = new Set(view.called);
  const placed = new Set(view.grid.filter((n): n is number => n !== null));
  const nextNumber =
    Array.from({ length: view.grid.length }, (_, i) => i + 1).find((n) => !placed.has(n)) ?? null;
  // A pick only counts on your turn and while its number is still uncalled.
  const pickedNumber = isMyTurn && picked !== null ? (view.grid[picked] ?? null) : null;
  const selected = pickedNumber !== null && !called.has(pickedNumber) ? picked : null;

  const call = (n: number) => {
    setPicked(null);
    onIntent({ type: "call", n });
  };
  const onCellPress = (cell: number) => {
    const n = view.grid[cell] ?? null;
    if (isSetup && n === null && nextNumber !== null) {
      onIntent({ type: "place", cell, n: nextNumber });
    }
    if (!isMyTurn || n === null || called.has(n)) return;
    if (!needsConfirm || selected === cell) call(n);
    else setPicked(cell);
  };
  const canPress = (cell: number) => {
    const n = view.grid[cell] ?? null;
    return isSetup ? n === null : isMyTurn && n !== null && !called.has(n);
  };

  const yourColor = playerAt(players, view.you).color;
  const turnText =
    view.phase === "setup"
      ? isSetup
        ? null
        : "Waiting for everyone to get ready…"
      : isMyTurn
        ? needsConfirm
          ? "Your turn — pick a number, then call it"
          : "Your turn — tap a number to call it"
        : `${playerAt(players, view.turn ?? 0).name}’s turn`;

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="flex items-center gap-2 text-small font-semibold text-ink">
          <PlayerDot color={yourColor} isLarge />
          Your grid
        </span>
        <LineProgress count={view.yourLines.length} linesToWin={view.linesToWin} />
      </div>
      <BingoBoard
        size={view.size}
        grid={view.grid}
        marks={marksFor(view, players, view.you)}
        lines={view.yourLines}
        label="Your grid"
        isActive={isMyTurn}
        selected={selected}
        {...(isSetup || isMyTurn ? { onCellPress, canPress } : {})}
      />
      {turnText && (
        <p
          aria-live="polite"
          className={`text-center text-body ${isMyTurn ? "font-semibold text-pen" : "text-pencil"}`}
        >
          {turnText}
        </p>
      )}
      {selected !== null && pickedNumber !== null && (
        <Button
          className="animate-rise self-center motion-reduce:animate-fade-in"
          onClick={() => {
            call(pickedNumber);
          }}
        >
          Call {pickedNumber}
        </Button>
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
