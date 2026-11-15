import { lineCountFor, MAX_SIZE, MIN_SIZE, type BingoConfig } from "@heartroom/bingo";

/** Grid sizes the host can pick for a custom game, smallest first. */
export const CUSTOM_SIZES: readonly number[] = Array.from(
  { length: MAX_SIZE - MIN_SIZE + 1 },
  (_, i) => MIN_SIZE + i,
);

/**
 * A custom grid: a new size keeps the line target when it still fits (an N×N grid has 2N+2
 * lines), else it drops to the most that size has; lines stay between 1 and that maximum.
 */
export function withGrid(
  config: BingoConfig,
  change: { readonly size?: number; readonly linesToWin?: number },
): BingoConfig {
  const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, change.size ?? config.size));
  const wanted = change.linesToWin ?? config.linesToWin;
  const linesToWin = Math.min(lineCountFor(size), Math.max(1, wanted));
  return { ...config, size, linesToWin };
}
