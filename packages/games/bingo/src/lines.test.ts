import { describe, expect, it } from "vitest";
import { lineCountFor } from "./config.ts";
import { completedLines, lineCells } from "./lines.ts";

const identity = (size: number) => Array.from({ length: size * size }, (_, i) => i + 1);
const all = (size: number) => new Set(identity(size));

describe("lineCells", () => {
  it.each([3, 4, 5, 6, 7, 8])(
    "when the grid is %i wide, then there are 2N+2 lines of N cells",
    (size) => {
      const lines = lineCells(size);
      expect(lines).toHaveLength(lineCountFor(size));
      for (const cells of lines) expect(new Set(cells).size).toBe(size);
    },
  );

  it("when the grid is 3×3, then rows, columns and both diagonals are in id order", () => {
    expect(lineCells(3)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ]);
  });
});

describe("completedLines", () => {
  it.each([3, 4, 5, 6, 7, 8])(
    "when every number on a %i-wide grid is called, then every line is complete",
    (size) => {
      expect(completedLines(identity(size), size, all(size))).toHaveLength(lineCountFor(size));
    },
  );

  it("when one row and the main diagonal are called on 5×5, then exactly those two lines complete", () => {
    // Row 0 = 1…5, main diagonal = 1, 7, 13, 19, 25.
    const called = new Set([1, 2, 3, 4, 5, 7, 13, 19, 25]);
    expect(completedLines(identity(5), 5, called)).toEqual([0, 10]);
  });

  it("when a grid still has empty cells, then lines through them never complete", () => {
    const grid = [1, 2, null, 4, 5, 6, 7, 8, 9];
    // Cell 2 is empty: row 0, column 2 and the anti-diagonal cannot complete.
    expect(completedLines(grid, 3, all(3))).toEqual([1, 2, 3, 4, 6]);
  });
});
