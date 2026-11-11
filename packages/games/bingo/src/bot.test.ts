import { describe, expect, it } from "vitest";
import { createRng } from "@heartroom/engine";
import { BOT_LEVELS, chooseCall, fillGrid, type BotLevel } from "./bot.ts";
import { CLASSIC } from "./config.ts";
import { bingo } from "./module.ts";
import type { BingoState } from "./rules.ts";
import { playBotMatch, seedFor } from "./testing/bot-match.ts";
import type { BingoSeatView } from "./view.ts";

/** How often `level` (seat 0) wins outright against `other` on Classic, over fixed seeds. */
function winRate(level: BotLevel, other: BotLevel, games: number): number {
  let wins = 0;
  for (let i = 0; i < games; i++) {
    const state = playBotMatch({ ...CLASSIC, firstSeat: i % 2 }, [level, other], i);
    if (state.winners.length === 1 && state.winners[0] === 0) wins++;
  }
  return wins / games;
}

describe("bot", () => {
  it("fills a grid with every number once", () => {
    const grid = fillGrid(4, createRng(seedFor(1))).sort((a, b) => a - b);
    expect(grid).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it("when one number completes a line, then Hard calls it", () => {
    const base = bingo.setup({ ...CLASSIC, size: 3, linesToWin: 3 }, 2, createRng(seedFor(1)));
    const state: BingoState = {
      ...base,
      phase: "playing",
      grids: [
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [9, 8, 7, 6, 5, 4, 3, 2, 1],
      ],
      called: [1, 2, 6],
    };
    const view = bingo.view(state, { kind: "seat", seat: 0 }) as BingoSeatView;
    for (let i = 0; i < 20; i++) expect(chooseCall(view, "hard", createRng(seedFor(i)))).toBe(3);
  });

  it("never errors or stalls across 10,000 seeded games at every size, seat count and level", () => {
    for (let i = 0; i < 10_000; i++) {
      const size = 3 + (i % 6);
      const seats = 2 + (i % 5);
      const levels = Array.from({ length: seats }, (_, s) => BOT_LEVELS[(i + s) % 3] as BotLevel);
      const linesToWin = 1 + (i % (2 * size + 2));
      const state = playBotMatch({ ...CLASSIC, size, linesToWin, firstSeat: i % seats }, levels, i);
      expect(state.phase).toBe("done");
    }
  }, 120_000);

  // Thresholds = the rate measured on these 2,000 seeds on 2026-11-11 minus 3 points
  // (measured: 95.9%, 77.9%, 67.8%). A drop means a bot change made the levels closer together.
  it.each<[BotLevel, BotLevel, number]>([
    ["hard", "easy", 0.929],
    ["hard", "medium", 0.749],
    ["medium", "easy", 0.648],
  ])(
    "when %s plays %s on Classic, then it wins at least the measured rate",
    (level, other, min) => {
      expect(winRate(level, other, 2000)).toBeGreaterThanOrEqual(min);
    },
    60_000,
  );
});
