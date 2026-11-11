import type { Rng } from "@heartroom/engine";
import { lineCells } from "./lines.ts";
import { uncalled } from "./rules.ts";
import type { BingoSeatView } from "./view.ts";

/**
 * The vs Computer opponent. It is given only its own seat's view, so by type it cannot read the
 * player's grid: it knows what a human in its seat would know.
 */

export const BOT_LEVELS = ["easy", "medium", "hard"] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

export function fillGrid(size: number, rng: Rng): number[] {
  return rng.shuffle(Array.from({ length: size * size }, (_, i) => i + 1));
}

/** Share of Medium's calls that use Hard's strategy; the rest are random. */
const MEDIUM_SKILL = 0.5;

/**
 * Hard: the number that pushes its own nearly-done lines furthest. Medium: Hard's choice half the
 * time, otherwise random. Easy: any uncalled number. A 2026-11-11 simulation showed smarter-looking
 * plans do no better than this greedy choice in 1…N² Bingo, so the levels differ by how often
 * the bot plays well rather than by different strategies.
 */
export function chooseCall(view: BingoSeatView, level: BotLevel, rng: Rng): number {
  const options = uncalled(view);
  const playsWell =
    level === "hard" || (level === "medium" && rng.int(1, 100) <= MEDIUM_SKILL * 100);
  if (!playsWell) return rng.pick(options);
  const marked = markedCells(view);
  const cellOf = new Map(view.grid.map((n, cell) => [n, cell]));
  return best(options, (n) => lineProgress(view.size, marked, cellOf.get(n) as number), rng);
}

function markedCells(view: BingoSeatView): Set<number> {
  const called = new Set(view.called);
  const marked = new Set<number>();
  view.grid.forEach((n, cell) => {
    if (n !== null && called.has(n)) marked.add(cell);
  });
  return marked;
}

/** Sum over the lines through `cell` of 4^(cells already marked): near-done lines dominate. */
function lineProgress(size: number, marked: ReadonlySet<number>, cell: number): number {
  return lineCells(size)
    .filter((cells) => cells.includes(cell))
    .reduce((sum, cells) => sum + 4 ** cells.filter((c) => marked.has(c)).length, 0);
}

/** The highest-scoring option; ties are broken at random so the bot is not predictable. */
function best(options: readonly number[], score: (n: number) => number, rng: Rng): number {
  let top = -Infinity;
  let tied: number[] = [];
  for (const n of options) {
    const s = score(n);
    if (s > top) [top, tied] = [s, [n]];
    else if (s === top) tied.push(n);
  }
  return rng.pick(tied);
}
