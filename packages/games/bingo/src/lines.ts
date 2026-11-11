/**
 * Line geometry for an N×N grid stored row by row in a flat array. Line ids: 0…N-1 rows,
 * N…2N-1 columns, 2N the main diagonal, 2N+1 the anti-diagonal.
 */

const cache = new Map<number, readonly (readonly number[])[]>();

/** Cell indexes of every line, cached per size (there are only six sizes). */
export function lineCells(size: number): readonly (readonly number[])[] {
  const known = cache.get(size);
  if (known) return known;
  const range = Array.from({ length: size }, (_, i) => i);
  const lines = [
    ...range.map((r) => range.map((c) => r * size + c)),
    ...range.map((c) => range.map((r) => r * size + c)),
    range.map((i) => i * size + i),
    range.map((i) => i * size + (size - 1 - i)),
  ];
  cache.set(size, lines);
  return lines;
}

/** Ids of the lines whose every number has been called. */
export function completedLines(
  grid: readonly (number | null)[],
  size: number,
  called: ReadonlySet<number>,
): number[] {
  const done: number[] = [];
  lineCells(size).forEach((cells, id) => {
    if (cells.every((cell) => isMarked(grid[cell], called))) done.push(id);
  });
  return done;
}

export function isMarked(value: number | null | undefined, called: ReadonlySet<number>): boolean {
  return value !== null && value !== undefined && called.has(value);
}
