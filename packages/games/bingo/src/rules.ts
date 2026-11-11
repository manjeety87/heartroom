import { z } from "zod";
import type { Deadline, MatchResult, Ok, Rng, RuleError } from "@heartroom/engine";
import {
  MAX_SIZE,
  NUDGE_MS,
  setupMsFor,
  TURN_MS,
  type BingoConfig,
  type TimerMode,
} from "./config.ts";
import { completedLines } from "./lines.ts";

/**
 * Bingo 1…N²: every seat fills an N×N grid with 1…N², then seats take turns calling numbers. A
 * called number is marked on every grid. Everyone who reaches `linesToWin` on the same call wins
 * together. The rules never assume 5×5.
 */

export type BingoPhase = "setup" | "playing" | "done";

export type BingoState = {
  readonly size: number;
  readonly linesToWin: number;
  readonly timer: TimerMode;
  readonly seats: number;
  readonly phase: BingoPhase;
  /** One flat grid per seat, row by row; `null` = not filled yet. */
  readonly grids: readonly (readonly (number | null)[])[];
  readonly ready: readonly boolean[];
  readonly called: readonly number[];
  /** `callers[i]` is the seat that called `called[i]`. */
  readonly callers: readonly number[];
  readonly turn: number;
  /** Chill mode: someone pressed Nudge, so the current turn now has a clock. */
  readonly nudged: boolean;
  /** Completed line ids per seat, stored at each call so views never re-read a hidden grid. */
  readonly lines: readonly (readonly number[])[];
  readonly winners: readonly number[];
};

const MAX_CELLS = MAX_SIZE * MAX_SIZE;
const number = z.number().int().min(1).max(MAX_CELLS);

export const bingoActionSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("place"),
    cell: z
      .number()
      .int()
      .min(0)
      .max(MAX_CELLS - 1),
    n: number,
  }),
  /** A whole grid at once: what Shuffle sends (the client shuffles its own grid). */
  z.strictObject({ type: z.literal("fill"), grid: z.array(number).max(MAX_CELLS) }),
  z.strictObject({ type: z.literal("clear") }),
  z.strictObject({ type: z.literal("ready") }),
  z.strictObject({ type: z.literal("call"), n: number }),
  z.strictObject({ type: z.literal("nudge") }),
]);

export type BingoAction = z.infer<typeof bingoActionSchema>;

const violation = (reason: string): RuleError => ({ ok: false, code: "RULE_VIOLATION", reason });
const OK: Ok = { ok: true };

export function setup(config: BingoConfig, seats: number): BingoState {
  if (seats < 2 || seats > 6) throw new RangeError("bingo needs 2–6 seats");
  if (config.firstSeat >= seats) throw new RangeError("firstSeat is not a seat in this game");
  const cells = config.size * config.size;
  return {
    size: config.size,
    linesToWin: config.linesToWin,
    timer: config.timer,
    seats,
    phase: "setup",
    grids: Array.from({ length: seats }, () => new Array<number | null>(cells).fill(null)),
    ready: new Array<boolean>(seats).fill(false),
    called: [],
    callers: [],
    turn: config.firstSeat,
    nudged: false,
    lines: Array.from({ length: seats }, () => []),
    winners: [],
  };
}

export function validate(state: BingoState, seat: number, action: BingoAction): Ok | RuleError {
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.seats) return violation("no_such_seat");
  if (state.phase === "done") return violation("game_over");
  switch (action.type) {
    case "place":
    case "fill":
    case "clear":
    case "ready":
      return validateSetup(state, seat, action);
    case "call":
    case "nudge":
      return validatePlay(state, seat, action);
  }
}

type SetupAction = Extract<BingoAction, { type: "place" | "fill" | "clear" | "ready" }>;
type PlayAction = Extract<BingoAction, { type: "call" | "nudge" }>;

function validateSetup(state: BingoState, seat: number, action: SetupAction): Ok | RuleError {
  if (state.phase !== "setup") return violation("wrong_phase");
  if (state.ready[seat]) return violation("already_ready");
  const grid = state.grids[seat] as readonly (number | null)[];
  const cells = state.size * state.size;
  switch (action.type) {
    case "place":
      if (action.cell >= cells || action.n > cells) return violation("out_of_range");
      if (grid[action.cell] !== null) return violation("cell_taken");
      return grid.includes(action.n) ? violation("number_used") : OK;
    case "fill":
      return isFullGrid(action.grid, cells) ? OK : violation("bad_grid");
    case "clear":
      return OK;
    case "ready":
      return grid.includes(null) ? violation("grid_incomplete") : OK;
  }
}

function validatePlay(state: BingoState, seat: number, action: PlayAction): Ok | RuleError {
  if (state.phase !== "playing") return violation("wrong_phase");
  if (action.type === "nudge") {
    if (state.timer !== "chill") return violation("no_nudge_in_this_mode");
    if (seat === state.turn) return violation("own_turn");
    return state.nudged ? violation("already_nudged") : OK;
  }
  if (seat !== state.turn) return { ok: false, code: "NOT_YOUR_TURN", reason: "not_your_turn" };
  if (action.n > state.size * state.size) return violation("out_of_range");
  return state.called.includes(action.n) ? violation("already_called") : OK;
}

/** A permutation of 1…cells. */
function isFullGrid(grid: readonly number[], cells: number): boolean {
  if (grid.length !== cells) return false;
  const seen = new Set(grid);
  return seen.size === cells && grid.every((n) => n >= 1 && n <= cells);
}

export function apply(state: BingoState, seat: number, action: BingoAction): BingoState {
  switch (action.type) {
    case "place":
      return withGrid(state, seat, (grid) =>
        grid.map((v, i) => (i === action.cell ? action.n : v)),
      );
    case "fill":
      return withGrid(state, seat, () => [...action.grid]);
    case "clear":
      return withGrid(state, seat, (grid) => grid.map(() => null));
    case "ready":
      return markReady(state, seat);
    case "call":
      return call(state, seat, action.n);
    case "nudge":
      return { ...state, nudged: true };
  }
}

function withGrid(
  state: BingoState,
  seat: number,
  change: (grid: readonly (number | null)[]) => (number | null)[],
): BingoState {
  return { ...state, grids: state.grids.map((grid, s) => (s === seat ? change(grid) : grid)) };
}

function markReady(state: BingoState, seat: number): BingoState {
  const ready = state.ready.map((r, s) => r || s === seat);
  const isEveryoneReady = ready.every(Boolean);
  return { ...state, ready, phase: isEveryoneReady ? "playing" : "setup" };
}

function call(state: BingoState, seat: number, n: number): BingoState {
  const called = [...state.called, n];
  const calledSet = new Set(called);
  const lines = state.grids.map((grid) => completedLines(grid, state.size, calledSet));
  const winners = lines.flatMap((done, s) => (done.length >= state.linesToWin ? [s] : []));
  return {
    ...state,
    called,
    callers: [...state.callers, seat],
    lines,
    winners,
    phase: winners.length > 0 ? "done" : "playing",
    turn: (state.turn + 1) % state.seats,
    nudged: false,
  };
}

export function nextDeadline(state: BingoState): Deadline | null {
  if (state.phase === "setup") {
    const seat = state.ready.indexOf(false);
    return { seat, at: setupMsFor(state.size), key: "setup" };
  }
  if (state.phase === "done") return null;
  const key = `turn:${state.called.length}`;
  switch (state.timer) {
    case "fast":
      return { seat: state.turn, at: TURN_MS, key };
    case "away-only":
      return { seat: state.turn, at: TURN_MS, key, onlyWhenAway: true };
    case "chill":
      return state.nudged
        ? { seat: state.turn, at: NUDGE_MS, key: `nudge:${state.called.length}` }
        : null;
  }
}

/** Setup timeout: keep what the seat placed, fill the rest randomly, then ready. Turn: random call. */
export function autoAction(state: BingoState, seat: number, rng: Rng): BingoAction {
  if (state.phase === "done") throw new Error("no auto action after the game ends");
  if (state.phase === "playing") return { type: "call", n: rng.pick(uncalled(state)) };
  const grid = state.grids[seat] as readonly (number | null)[];
  if (!grid.includes(null)) return { type: "ready" };
  const missing = rng.shuffle(
    Array.from({ length: grid.length }, (_, i) => i + 1).filter((n) => !grid.includes(n)),
  );
  return { type: "fill", grid: grid.map((v) => v ?? (missing.pop() as number)) };
}

export function uncalled(state: Pick<BingoState, "size" | "called">): number[] {
  const called = new Set(state.called);
  return Array.from({ length: state.size * state.size }, (_, i) => i + 1).filter(
    (n) => !called.has(n),
  );
}

/** Winners share first place; everyone else is ranked by lines completed. */
export function result(state: BingoState): MatchResult | null {
  if (state.phase !== "done") return null;
  const counts = state.lines.map((l) => l.length);
  const winners = new Set(state.winners);
  const placements = counts.map((count, seat) =>
    winners.has(seat)
      ? 1
      : 1 + winners.size + counts.filter((c, s) => !winners.has(s) && c > count).length,
  );
  return {
    winners: [...state.winners],
    placements,
    details: { lines: counts, calls: state.called.length },
  };
}
