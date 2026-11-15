import { bingoConfigSchema, CLASSIC } from "@heartroom/bingo";
import { describe, expect, it } from "vitest";
import { CUSTOM_SIZES, withGrid } from "./bingo-custom.ts";

describe("withGrid", () => {
  it("offers every size the rules allow", () => {
    expect(CUSTOM_SIZES).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("keeps the line target when it fits and lowers it when the grid shrinks", () => {
    expect(withGrid(CLASSIC, { size: 7 })).toMatchObject({ size: 7, linesToWin: 5 });
    const big = withGrid(CLASSIC, { size: 8, linesToWin: 18 });
    expect(big).toMatchObject({ size: 8, linesToWin: 18 });
    // A 3×3 grid has 8 lines in all.
    expect(withGrid(big, { size: 3 })).toMatchObject({ size: 3, linesToWin: 8 });
  });

  it("keeps lines between 1 and the grid's total, and every result passes the game's schema", () => {
    expect(withGrid(CLASSIC, { linesToWin: 0 }).linesToWin).toBe(1);
    expect(withGrid(CLASSIC, { linesToWin: 99 }).linesToWin).toBe(12);
    for (const size of CUSTOM_SIZES) {
      for (const linesToWin of [0, 1, 5, 99]) {
        expect(bingoConfigSchema.safeParse(withGrid(CLASSIC, { size, linesToWin })).success).toBe(
          true,
        );
      }
    }
  });
});
