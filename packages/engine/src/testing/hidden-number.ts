import { z } from "zod";
import { defineGame, type Viewer } from "../module.ts";

/**
 * A tiny two-seat game used to test the engine and, later, the room: each seat gets a secret number,
 * and players take turns guessing the other's. Each guess is answered higher / lower / correct.
 * Small enough to read in one go, but it has everything a real game has: hidden data, turns,
 * a deadline, auto-play, a result and an end-of-game reveal.
 */

const TURN_MS = 15_000;

const configSchema = z.strictObject({ maxNumber: z.number().int().min(2).max(100) });
const actionSchema = z.strictObject({
  type: z.literal("guess"),
  value: z.number().int().min(1).max(100),
});

export type HiddenNumberConfig = z.infer<typeof configSchema>;
export type HiddenNumberAction = z.infer<typeof actionSchema>;

type Feedback = "higher" | "lower" | "correct";
type Guess = { readonly seat: number; readonly value: number; readonly feedback: Feedback };

export type HiddenNumberState = {
  readonly maxNumber: number;
  readonly secrets: readonly [number, number];
  readonly turn: number;
  /** Feedback is stored when the guess is made, so the view never re-reads a secret to show it. */
  readonly guesses: readonly Guess[];
  readonly winner: number | null;
};

export type HiddenNumberView = {
  readonly you: number | null;
  readonly yourSecret: number | null;
  readonly turn: number | null;
  readonly guesses: readonly Guess[];
  readonly winner: number | null;
  /** Both secrets, only once the game is over. */
  readonly reveal: readonly number[] | null;
};

const other = (seat: number): number => 1 - seat;

function guessedBy(state: HiddenNumberState, seat: number): Set<number> {
  return new Set(state.guesses.filter((g) => g.seat === seat).map((g) => g.value));
}

export const hiddenNumber = defineGame({
  id: "hidden-number",
  version: 1,
  players: { min: 2, max: 2 },
  configSchema,
  actionSchema,
  isRanked: () => false,

  setup(config: HiddenNumberConfig, seats, rng): HiddenNumberState {
    if (seats !== 2) throw new RangeError("hidden-number needs exactly 2 seats");
    const secret = () => rng.int(1, config.maxNumber);
    return {
      maxNumber: config.maxNumber,
      secrets: [secret(), secret()],
      turn: 0,
      guesses: [],
      winner: null,
    };
  },

  validate(state, seat, action: HiddenNumberAction) {
    if (state.winner !== null) return { ok: false, code: "RULE_VIOLATION", reason: "game_over" };
    if (seat !== state.turn) return { ok: false, code: "NOT_YOUR_TURN", reason: "not_your_turn" };
    if (action.value > state.maxNumber) {
      return { ok: false, code: "RULE_VIOLATION", reason: "out_of_range" };
    }
    if (guessedBy(state, seat).has(action.value)) {
      return { ok: false, code: "RULE_VIOLATION", reason: "already_guessed" };
    }
    return { ok: true };
  },

  apply(state, seat, action) {
    const target = state.secrets[other(seat)] as number;
    const feedback: Feedback =
      action.value === target ? "correct" : action.value < target ? "higher" : "lower";
    const isHit = feedback === "correct";
    return {
      ...state,
      guesses: [...state.guesses, { seat, value: action.value, feedback }],
      turn: isHit ? state.turn : other(seat),
      winner: isHit ? seat : null,
    };
  },

  nextDeadline(state) {
    if (state.winner !== null) return null;
    return { seat: state.turn, at: TURN_MS, key: `turn:${state.guesses.length}` };
  },

  autoAction(state, seat, rng) {
    const tried = guessedBy(state, seat);
    const open = Array.from({ length: state.maxNumber }, (_, i) => i + 1).filter(
      (n) => !tried.has(n),
    );
    return { type: "guess" as const, value: rng.pick(open) };
  },

  view(state, viewer: Viewer): HiddenNumberView {
    const isOver = state.winner !== null;
    const you = viewer.kind === "seat" ? viewer.seat : null;
    return {
      you,
      yourSecret: you === null ? null : (state.secrets[you] ?? null),
      turn: isOver ? null : state.turn,
      guesses: state.guesses,
      winner: state.winner,
      reveal: isOver ? [...state.secrets] : null,
    };
  },

  result(state) {
    if (state.winner === null) return null;
    const winner = state.winner;
    return {
      winners: [winner],
      placements: [0, 1].map((seat) => (seat === winner ? 1 : 2)),
      details: { guesses: state.guesses.length },
    };
  },

  perturbHidden(state, viewer, rng) {
    if (state.winner !== null) return state;
    const known = viewer.kind === "seat" ? viewer.seat : null;
    // Always a different number, so every perturbation really tests the view.
    const changeFrom = (secret: number): number => {
      const n = rng.int(1, state.maxNumber - 1);
      return n >= secret ? n + 1 : n;
    };
    const secrets = state.secrets.map((secret, seat) =>
      seat === known ? secret : changeFrom(secret),
    ) as [number, number];
    return { ...state, secrets };
  },
});
