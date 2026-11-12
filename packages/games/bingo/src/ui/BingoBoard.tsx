import { useRef, useState, type KeyboardEvent } from "react";
import { lineCells } from "../lines.ts";
import { cellLabel } from "./a11y.ts";

export type BingoBoardProps = {
  readonly size: number;
  readonly grid: readonly (number | null)[];
  readonly called: readonly number[];
  /** Completed line ids, struck through with ink. */
  readonly lines: readonly number[];
  /** Accessible name of the whole board, e.g. "Your grid". */
  readonly label: string;
  /** Called on tap, Enter or Space. Without it the board is read-only. */
  readonly onCellPress?: (cell: number) => void;
  /** Which cells can be pressed right now (e.g. uncalled numbers on your turn). */
  readonly canPress?: (cell: number) => boolean;
  /** Your turn: the border turns to pen. */
  readonly isActive?: boolean;
  /** Small board for the end-of-game reveal. */
  readonly isCompact?: boolean;
};

/**
 * An N×N Bingo grid. It renders whatever grid it is given and reports presses; it never decides
 * anything. Keyboard: arrow keys move, Home/End jump within a row, Enter or Space presses.
 */
export function BingoBoard({
  size,
  grid,
  called,
  lines,
  label,
  onCellPress,
  canPress = () => true,
  isActive = false,
  isCompact = false,
}: BingoBoardProps) {
  const [focused, setFocused] = useState(0);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const calledSet = new Set(called);
  const isInteractive = onCellPress !== undefined;

  const moveFocus = (cell: number) => {
    setFocused(cell);
    cellRefs.current[cell]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent, cell: number) => {
    const row = Math.floor(cell / size);
    const col = cell % size;
    const target = {
      ArrowRight: row * size + Math.min(size - 1, col + 1),
      ArrowLeft: row * size + Math.max(0, col - 1),
      ArrowDown: Math.min(size - 1, row + 1) * size + col,
      ArrowUp: Math.max(0, row - 1) * size + col,
      Home: row * size,
      End: row * size + size - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    moveFocus(target);
  };

  const rows = Array.from({ length: size }, (_, r) => r);
  const textSize = isCompact ? "text-small" : size >= 7 ? "text-title" : "text-bingo-cell";

  return (
    <div
      className={`relative w-full rounded-card bg-sheet p-2 ring-2 transition-[box-shadow] duration-(--duration-popover) ease-out ${
        isActive ? "ring-pen" : "ring-line"
      }`}
    >
      <div role="grid" aria-label={label} className="grid gap-1.5">
        {rows.map((r) => (
          <div
            key={r}
            role="row"
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {rows.map((c) => {
              const cell = r * size + c;
              const n = grid[cell] ?? null;
              const isMarked = n !== null && calledSet.has(n);
              const isPressable = isInteractive && canPress(cell);
              return (
                <div key={c} role="gridcell" className="aspect-square">
                  <button
                    ref={(el) => {
                      cellRefs.current[cell] = el;
                    }}
                    type="button"
                    tabIndex={isInteractive && cell === focused ? 0 : -1}
                    aria-label={cellLabel(n, isMarked, cell, size)}
                    aria-disabled={!isPressable}
                    onFocus={() => {
                      setFocused(cell);
                    }}
                    onKeyDown={(event) => {
                      onKeyDown(event, cell);
                    }}
                    onClick={() => {
                      if (isPressable) onCellPress(cell);
                    }}
                    className={`relative flex size-full touch-manipulation select-none items-center justify-center rounded-cell font-display font-bold tabular-nums ${textSize} ${
                      n === null ? "bg-well text-pencil" : "bg-paper text-ink"
                    } ${isPressable ? "cursor-pointer" : "cursor-default"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen`}
                  >
                    {n ?? ""}
                    {isMarked && <InkRing />}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <LineStrikes size={size} lines={lines} />
    </div>
  );
}

/** The called-number mark: a hand-drawn-looking ring that inks itself in. */
function InkRing() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 40 40"
      className="pointer-events-none absolute inset-0 size-full text-margin"
    >
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        transform="rotate(-80 20 20)"
        className="animate-ink-draw motion-reduce:animate-fade-in"
      />
    </svg>
  );
}

/** Completed lines as pen strokes over the grid, in grid units (one cell = 1). */
function LineStrikes({
  size,
  lines,
}: {
  readonly size: number;
  readonly lines: readonly number[];
}) {
  const inset = 0.25;
  const ends = (id: number): [number, number, number, number] => {
    const cells = lineCells(size)[id] ?? [];
    const first = cells[0] ?? 0;
    const last = cells.at(-1) ?? 0;
    const centre = (cell: number): [number, number] => [
      (cell % size) + 0.5,
      Math.floor(cell / size) + 0.5,
    ];
    const [x1, y1] = centre(first);
    const [x2, y2] = centre(last);
    const dx = Math.sign(x2 - x1) * (0.5 - inset);
    const dy = Math.sign(y2 - y1) * (0.5 - inset);
    return [x1 - dx, y1 - dy, x2 + dx, y2 + dy];
  };
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-2 text-pen"
      style={{ width: "calc(100% - 1rem)", height: "calc(100% - 1rem)" }}
    >
      {lines.map((id) => {
        const [x1, y1, x2, y2] = ends(id);
        return (
          <line
            key={id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={0.08}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            className="animate-line-strike opacity-80 motion-reduce:animate-fade-in"
          />
        );
      })}
    </svg>
  );
}
