import type { Rng, Viewer } from "@heartroom/engine";
import type { TimerMode } from "./config.ts";
import type { BingoPhase, BingoState } from "./rules.ts";

/** What everyone may see: no grid except, once the game is over, all of them. */
export type BingoPublicView = {
  readonly size: number;
  readonly linesToWin: number;
  readonly timer: TimerMode;
  readonly seats: number;
  readonly phase: BingoPhase;
  readonly ready: readonly boolean[];
  readonly called: readonly number[];
  readonly callers: readonly number[];
  /** Whose call it is; during setup, who will call first. `null` once the game is over. */
  readonly turn: number | null;
  readonly nudged: boolean;
  /** Lines completed per seat: opponents see only these counts. */
  readonly lineCounts: readonly number[];
  readonly winners: readonly number[];
  /** Every grid and its completed lines, only once the game is over. */
  readonly reveal: {
    readonly grids: readonly (readonly (number | null)[])[];
    readonly lines: readonly (readonly number[])[];
  } | null;
};

export type BingoSeatView = BingoPublicView & {
  readonly kind: "seat";
  readonly you: number;
  readonly grid: readonly (number | null)[];
  readonly yourLines: readonly number[];
};

export type BingoSpectatorView = BingoPublicView & { readonly kind: "spectator" };

export type BingoView = BingoSeatView | BingoSpectatorView;

export function view(state: BingoState, viewer: Viewer): BingoView {
  const isOver = state.phase === "done";
  const common: BingoPublicView = {
    size: state.size,
    linesToWin: state.linesToWin,
    timer: state.timer,
    seats: state.seats,
    phase: state.phase,
    ready: state.ready,
    called: state.called,
    callers: state.callers,
    turn: isOver ? null : state.turn,
    nudged: state.nudged,
    lineCounts: state.lines.map((l) => l.length),
    winners: state.winners,
    reveal: isOver ? { grids: state.grids, lines: state.lines } : null,
  };
  const seat = viewer.kind === "seat" ? viewer.seat : -1;
  const grid = state.grids[seat];
  if (grid === undefined) return { ...common, kind: "spectator" };
  return { ...common, kind: "seat", you: seat, grid, yourLines: state.lines[seat] ?? [] };
}

/** Test-only (see `assertNoLeak`): shuffles every grid the viewer must not see. */
export function perturbHidden(state: BingoState, viewer: Viewer, rng: Rng): BingoState {
  if (state.phase === "done") return state;
  const own = viewer.kind === "seat" ? viewer.seat : -1;
  return {
    ...state,
    grids: state.grids.map((grid, seat) => (seat === own ? grid : rng.shuffle(grid))),
  };
}
