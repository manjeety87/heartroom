import { describe, expect, it } from "vitest";
import { createRng, replay, startMatch, step, type LogEntry } from "@heartroom/engine";
import { assertNoLeak } from "@heartroom/engine/testing";
import {
  bingoConfigSchema,
  CLASSIC,
  isClassic,
  NUDGE_MS,
  setupMsFor,
  TURN_MS,
  type BingoConfig,
} from "./config.ts";
import { bingo } from "./module.ts";
import type { BingoAction, BingoState } from "./rules.ts";
import { seedFor } from "./testing/bot-match.ts";

const rng = () => createRng(seedFor(9));
const identity = (size: number) => Array.from({ length: size * size }, (_, i) => i + 1);

/** A started game: each seat's grid given, everyone ready. */
function started(grids: number[][], config: Partial<BingoConfig> = {}): BingoState {
  let state = bingo.setup({ ...CLASSIC, ...config }, grids.length, rng());
  grids.forEach((grid, seat) => {
    state = bingo.apply(state, seat, { type: "fill", grid });
    state = bingo.apply(state, seat, { type: "ready" });
  });
  return state;
}

const reasonOf = (state: BingoState, seat: number, action: BingoAction) => {
  const verdict = bingo.validate(state, seat, action);
  return verdict.ok ? "ok" : verdict.reason;
};

describe("config", () => {
  it("when linesToWin is more than the grid has, then the config is rejected", () => {
    expect(bingoConfigSchema.safeParse({ ...CLASSIC, size: 3, linesToWin: 9 }).success).toBe(false);
    expect(bingoConfigSchema.safeParse({ ...CLASSIC, size: 3, linesToWin: 8 }).success).toBe(true);
  });

  it("when the grid is 5×5 with 5 lines, then and only then it is Classic (ranked)", () => {
    expect(isClassic(CLASSIC)).toBe(true);
    expect(isClassic({ size: 5, linesToWin: 4 })).toBe(false);
    expect(isClassic({ size: 6, linesToWin: 5 })).toBe(false);
  });

  it.each([
    [3, 20_000],
    [5, 30_000],
    [6, 52_000],
    [8, 90_000],
  ])("when the grid is %i wide, then setup lasts %i ms", (size, ms) => {
    expect(setupMsFor(size)).toBe(ms);
  });
});

describe("setup", () => {
  it.each([1, 7])("when there are %i seats, then setup throws", (seats) => {
    expect(() => bingo.setup(CLASSIC, seats, rng())).toThrow(RangeError);
  });

  it("when firstSeat is not in the game, then setup throws", () => {
    expect(() => bingo.setup({ ...CLASSIC, firstSeat: 3 }, 2, rng())).toThrow(RangeError);
  });

  it("when a seat taps in order, then each number lands in its cell until the grid is full", () => {
    let state = bingo.setup({ ...CLASSIC, size: 3, linesToWin: 3 }, 2, rng());
    identity(3).forEach((n, cell) => {
      state = bingo.apply(state, 0, { type: "place", cell, n });
    });
    expect(state.grids[0]).toEqual(identity(3));
    expect(reasonOf(state, 0, { type: "ready" })).toBe("ok");
  });

  it.each<[string, BingoAction, string]>([
    ["a cell outside the grid", { type: "place", cell: 25, n: 2 }, "out_of_range"],
    ["a number above N²", { type: "place", cell: 1, n: 26 }, "out_of_range"],
    ["a taken cell", { type: "place", cell: 0, n: 2 }, "cell_taken"],
    ["a number already used", { type: "place", cell: 1, n: 1 }, "number_used"],
    ["a grid with a repeat", { type: "fill", grid: [...identity(5).slice(0, 24), 1] }, "bad_grid"],
    ["a grid of the wrong size", { type: "fill", grid: identity(4) }, "bad_grid"],
    ["a grid with 0", { type: "fill", grid: [0, ...identity(5).slice(1)] }, "bad_grid"],
    ["ready with empty cells", { type: "ready" }, "grid_incomplete"],
    ["a call before play starts", { type: "call", n: 1 }, "wrong_phase"],
  ])("when a seat sends %s during setup, then it is rejected", (_, action, reason) => {
    const state = bingo.apply(bingo.setup(CLASSIC, 2, rng()), 0, { type: "place", cell: 0, n: 1 });
    expect(reasonOf(state, 0, action)).toBe(reason);
  });

  it("when a seat clears its grid, then every cell is empty again", () => {
    const state = bingo.apply(bingo.setup(CLASSIC, 2, rng()), 0, {
      type: "fill",
      grid: identity(5),
    });
    expect(bingo.apply(state, 0, { type: "clear" }).grids[0]?.every((v) => v === null)).toBe(true);
  });

  it("when a ready seat changes its grid, then it is rejected", () => {
    let state = bingo.apply(bingo.setup(CLASSIC, 2, rng()), 0, {
      type: "fill",
      grid: identity(5),
    });
    state = bingo.apply(state, 0, { type: "ready" });
    expect(state.phase).toBe("setup");
    expect(reasonOf(state, 0, { type: "clear" })).toBe("already_ready");
  });

  it("when everyone is ready, then play starts with firstSeat", () => {
    const state = started([identity(5), identity(5), identity(5)], { firstSeat: 2 });
    expect(state.phase).toBe("playing");
    expect(state.turn).toBe(2);
  });

  it("when the setup clock runs out, then the seat keeps its own numbers and the rest are filled", () => {
    let state = bingo.apply(bingo.setup(CLASSIC, 2, rng()), 1, { type: "place", cell: 4, n: 9 });
    expect(bingo.nextDeadline(state)).toEqual({ seat: 0, at: 30_000, key: "setup" });
    const auto = bingo.autoAction(state, 1, rng());
    expect(auto.type === "fill" && auto.grid[4]).toBe(9);
    expect(reasonOf(state, 1, auto)).toBe("ok");
    state = bingo.apply(state, 1, auto);
    expect(bingo.autoAction(state, 1, rng())).toEqual({ type: "ready" });
  });
});

describe("play", () => {
  // The second grid is the first shifted by one cell, so 1…5 make a line only on the first.
  const grids = [identity(5), [...identity(5).slice(1), 1]];

  it("when seats call, then turns rotate and the number is marked for everyone", () => {
    let state = started(grids, { firstSeat: 1 });
    state = bingo.apply(state, 1, { type: "call", n: 13 });
    expect(state.turn).toBe(0);
    expect(state.called).toEqual([13]);
    expect(state.callers).toEqual([1]);
  });

  it.each<[string, number, BingoAction, string]>([
    ["out of turn", 1, { type: "call", n: 1 }, "not_your_turn"],
    ["a number above N²", 0, { type: "call", n: 26 }, "out_of_range"],
    ["a number already called", 0, { type: "call", n: 7 }, "already_called"],
    ["from a seat that does not exist", 2, { type: "call", n: 1 }, "no_such_seat"],
    ["a setup move", 0, { type: "clear" }, "wrong_phase"],
  ])("when a seat sends %s, then it is rejected", (_, seat, action, reason) => {
    const state = { ...started(grids), called: [7] };
    expect(reasonOf(state, seat, action)).toBe(reason);
  });

  it("when a call completes the target for one seat, then that seat alone wins", () => {
    let state = started(grids, { linesToWin: 1 });
    const calls = [
      [0, 1],
      [1, 2],
      [0, 3],
      [1, 4],
    ] as const;
    for (const [seat, n] of calls) state = bingo.apply(state, seat, { type: "call", n });
    expect(state.phase).toBe("playing");
    state = bingo.apply(state, 0, { type: "call", n: 5 });
    expect(state.winners).toEqual([0]);
    expect(bingo.result(state)).toEqual({
      winners: [0],
      placements: [1, 2],
      details: { lines: [1, 0], calls: 5 },
    });
    expect(reasonOf(state, 1, { type: "call", n: 6 })).toBe("game_over");
    expect(bingo.nextDeadline(state)).toBeNull();
  });

  it("when one call completes the target for two seats, then they win together", () => {
    // The third grid puts 1, 2, 3, 4, 7 on cells 0, 1, 3, 5, 7, which share no line.
    let state = started([identity(3), identity(3), [1, 2, 5, 3, 6, 4, 8, 7, 9]], {
      size: 3,
      linesToWin: 2,
    });
    // On the first two grids 1, 2, 3 is row 0 and 1, 4, 7 is column 0.
    for (const n of [1, 2, 3, 4, 7]) state = bingo.apply(state, state.turn, { type: "call", n });
    expect(state.winners).toEqual([0, 1]);
    expect(bingo.result(state)?.placements).toEqual([1, 1, 3]);
  });

  it("when losers have different line counts, then they are ranked by them", () => {
    const state: BingoState = {
      ...started(grids),
      seats: 4,
      phase: "done",
      winners: [2],
      lines: [[1], [], [1, 2], [3, 4]],
    };
    expect(bingo.result(state)?.placements).toEqual([3, 4, 1, 2]);
  });

  it("when nobody has won, then there is no result", () => {
    expect(bingo.result(started(grids))).toBeNull();
  });

  it("when a turn times out, then the auto call is an uncalled number", () => {
    const state = { ...started(grids), called: identity(5).slice(0, 24) };
    expect(bingo.autoAction(state, 0, rng())).toEqual({ type: "call", n: 25 });
  });

  it("when the game is over, then there is no auto action", () => {
    const state: BingoState = { ...started(grids), phase: "done" };
    expect(() => bingo.autoAction(state, 0, rng())).toThrow();
  });
});

describe("timers", () => {
  const play = (timer: BingoConfig["timer"]) =>
    started([identity(4), identity(4)], { size: 4, linesToWin: 4, timer });

  it("when the mode is fast, then the turn seat has 15 s and each call restarts the clock", () => {
    const state = play("fast");
    expect(bingo.nextDeadline(state)).toEqual({ seat: 0, at: TURN_MS, key: "turn:0" });
    expect(bingo.nextDeadline(bingo.apply(state, 0, { type: "call", n: 1 }))?.key).toBe("turn:1");
  });

  it("when the mode is away-only, then the clock runs only while the seat is away", () => {
    expect(bingo.nextDeadline(play("away-only"))).toMatchObject({ onlyWhenAway: true });
  });

  it("when the mode is chill, then there is no clock until someone nudges, and a call resets it", () => {
    let state = play("chill");
    expect(bingo.nextDeadline(state)).toBeNull();
    expect(reasonOf(state, 0, { type: "nudge" })).toBe("own_turn");
    state = bingo.apply(state, 1, { type: "nudge" });
    expect(bingo.nextDeadline(state)).toEqual({ seat: 0, at: NUDGE_MS, key: "nudge:0" });
    expect(reasonOf(state, 1, { type: "nudge" })).toBe("already_nudged");
    expect(bingo.apply(state, 0, { type: "call", n: 1 }).nudged).toBe(false);
  });

  it("when the mode is not chill, then nudging is rejected", () => {
    expect(reasonOf(play("fast"), 1, { type: "nudge" })).toBe("no_nudge_in_this_mode");
  });
});

describe("contract", () => {
  // Six grid sizes × many perturbed replays: ~4 s alone, and slower when the whole suite runs at once.
  it("never shows a grid to anyone but its owner before the end", () => {
    assertNoLeak(bingo, {
      scenarios: [3, 4, 5, 6, 7, 8].map((size, i) => ({
        name: `${size}×${size}`,
        config: { ...CLASSIC, size, linesToWin: size },
        seats: 2 + (i % 5),
      })),
      games: 3,
    });
  }, 30_000);

  it("when a finished match is replayed from its log, then it reaches the same state", () => {
    const match = { config: { ...CLASSIC, size: 4, linesToWin: 3 }, seats: 3, seed: seedFor(4) };
    const auto = rng();
    let state = startMatch(bingo, match);
    const actions: LogEntry<BingoAction>[] = [];
    for (let d = bingo.nextDeadline(state); d; d = bingo.nextDeadline(state)) {
      const entry = {
        seat: d.seat,
        action: bingo.autoAction(state, d.seat, auto),
        by: "server" as const,
      };
      const result = step(bingo, state, entry);
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
      actions.push(entry);
    }
    expect(state.phase).toBe("done");
    expect(replay(bingo, { ...match, actions })).toEqual(state);
  });
});
