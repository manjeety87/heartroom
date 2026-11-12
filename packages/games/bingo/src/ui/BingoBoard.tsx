import { useRef, useState, type KeyboardEvent } from "react";
import { lineCells } from "../lines.ts";
import { cellLabel } from "./a11y.ts";

/** How a called number is inked: in the caller's colour, heavier if the viewer called it. */
export type Mark = { readonly color: string; readonly isHeavy: boolean; readonly by: string };

export type BingoBoardProps = {
  readonly size: number;
  readonly grid: readonly (number | null)[];
  /** Called numbers on this board and who called each. */
  readonly marks: ReadonlyMap<number, Mark>;
  /** Completed line ids, struck through with ink. */
  readonly lines: readonly number[];
  /** Accessible name of the whole board, e.g. "Your grid". */
  readonly label: string;
  /** Called on tap, Enter or Space. Without it the board is read-only. */
  readonly onCellPress?: (cell: number) => void;
  /** Which cells can be pressed right now (e.g. uncalled numbers on your turn). */
  readonly canPress?: (cell: number) => boolean;
  /** A cell picked but not yet confirmed (big grids call in two steps). */
  readonly selected?: number | null;
  /** Your turn: the border turns to pen. */
  readonly isActive?: boolean;
  /** Small board for the end-of-game reveal. */
  readonly isCompact?: boolean;
};

const KEY_MOVES: Readonly<Record<string, (row: number, col: number, size: number) => number>> = {
  ArrowRight: (r, c, n) => r * n + Math.min(n - 1, c + 1),
  ArrowLeft: (r, c, n) => r * n + Math.max(0, c - 1),
  ArrowDown: (r, c, n) => Math.min(n - 1, r + 1) * n + c,
  ArrowUp: (r, c, n) => Math.max(0, r - 1) * n + c,
  Home: (r, _c, n) => r * n,
  End: (r, _c, n) => r * n + n - 1,
};

/**
 * An N×N Bingo grid. It renders whatever grid it is given and reports presses; it never decides
 * anything. Keyboard: arrow keys move, Home/End jump within a row, Enter or Space presses.
 */
export function BingoBoard({
  size,
  grid,
  marks,
  lines,
  label,
  onCellPress,
  canPress = () => true,
  selected = null,
  isActive = false,
  isCompact = false,
}: BingoBoardProps) {
  const [focused, setFocused] = useState(0);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isInteractive = onCellPress !== undefined;
  const isDense = size >= 7;
  const gap = isCompact || isDense ? "gap-1" : "gap-1.5";
  const textSize = isCompact ? "text-small" : isDense ? "text-title" : "text-bingo-cell";

  const onKeyDown = (event: KeyboardEvent, cell: number) => {
    const move = KEY_MOVES[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const target = move(Math.floor(cell / size), cell % size, size);
    setFocused(target);
    cellRefs.current[target]?.focus();
  };

  const rows = Array.from({ length: size }, (_, r) => r);
  return (
    <div
      className={`relative w-full rounded-card bg-sheet ring-2 transition-[box-shadow] duration-(--duration-popover) ease-out ${
        isDense || isCompact ? "p-1.5" : "p-2"
      } ${isActive ? "ring-pen" : "ring-line"}`}
    >
      <div role="grid" aria-label={label} className={`grid ${gap}`}>
        {rows.map((r) => (
          <div
            key={r}
            role="row"
            className={`grid ${gap}`}
            style={{ gridTemplateColumns: `repeat(${String(size)}, minmax(0, 1fr))` }}
          >
            {rows.map((c) => {
              const cell = r * size + c;
              const n = grid[cell] ?? null;
              const mark = n === null ? undefined : marks.get(n);
              const isPressable = isInteractive && canPress(cell);
              const isSelected = selected === cell;
              return (
                <div key={c} role="gridcell" className="aspect-square">
                  <button
                    ref={(el) => {
                      cellRefs.current[cell] = el;
                    }}
                    type="button"
                    tabIndex={isInteractive && cell === focused ? 0 : -1}
                    aria-label={cellLabel(n, mark?.by ?? null, cell, size)}
                    aria-disabled={!isPressable}
                    aria-pressed={isSelected || undefined}
                    onFocus={() => {
                      setFocused(cell);
                    }}
                    onKeyDown={(event) => {
                      onKeyDown(event, cell);
                    }}
                    onClick={() => {
                      if (isPressable) onCellPress(cell);
                    }}
                    className={`relative flex size-full touch-manipulation select-none items-center justify-center rounded-cell font-display font-bold tabular-nums transition-[transform,background-color] duration-(--duration-press) ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen motion-reduce:transition-none ${textSize} ${
                      n === null ? "bg-well text-pencil" : "bg-paper text-ink"
                    } ${isPressable ? "cursor-pointer active:scale-95" : "cursor-default"} ${
                      isSelected ? "z-10 scale-110 bg-pen text-on-pen shadow-float" : ""
                    }`}
                  >
                    {n ?? ""}
                    {mark && <InkRing color={mark.color} isHeavy={mark.isHeavy} />}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <LineStrikes size={size} lines={lines} inset={isDense || isCompact ? "0.375rem" : "0.5rem"} />
    </div>
  );
}

/** The called-number mark: a ring that inks itself in, in the caller's colour. */
function InkRing({ color, isHeavy }: { readonly color: string; readonly isHeavy: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 40 40"
      className="pointer-events-none absolute inset-0 size-full"
      style={{ color }}
    >
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="none"
        stroke="currentColor"
        strokeWidth={isHeavy ? 3.6 : 2.4}
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
  inset,
}: {
  readonly size: number;
  readonly lines: readonly number[];
  readonly inset: string;
}) {
  const ends = (id: number): [number, number, number, number] => {
    const cells = lineCells(size)[id] ?? [];
    const centre = (cell: number): [number, number] => [
      (cell % size) + 0.5,
      Math.floor(cell / size) + 0.5,
    ];
    const [x1, y1] = centre(cells[0] ?? 0);
    const [x2, y2] = centre(cells.at(-1) ?? 0);
    const dx = Math.sign(x2 - x1) * 0.3;
    const dy = Math.sign(y2 - y1) * 0.3;
    return [x1 - dx, y1 - dy, x2 + dx, y2 + dy];
  };
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      className="pointer-events-none absolute text-ink"
      style={{ inset, width: `calc(100% - 2 * ${inset})`, height: `calc(100% - 2 * ${inset})` }}
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
            strokeWidth={0.07}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            className="animate-line-strike opacity-70 motion-reduce:animate-fade-in"
          />
        );
      })}
    </svg>
  );
}
