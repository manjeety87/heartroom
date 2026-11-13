import type { Deadline, MatchResult, Ok, Rng, RuleError } from "@heartroom/engine";
import { z } from "zod";
import {
  AWAY_GUESS_MS,
  MAX_LENGTH,
  MIN_LENGTH,
  SEATS,
  SETUP_MS,
  type WordGuessConfig,
} from "./config.ts";
import { feedback, isSolved, type Mark } from "./feedback.ts";

/**
 * Which words may be played. Injected, not imported: the lists are big and live on the server only
 * (`@heartroom/word-guess/words`); tests pass small ones.
 */
export type WordLists = {
  /** Secret words: everyday words people know (SCOWL ≤ 50). */
  isCommon(word: string): boolean;
  /** Guesses: any real word (a much larger list); every common word is valid too. */
  isValid(word: string): boolean;
  /** Common words of one length, for the word the server picks when time runs out. */
  commonOfLength(length: number): readonly string[];
};

export type WordGuessPhase = "setup" | "guessing" | "done";

/** One guess with its marks, worked out when it was made (so a view never needs the secret). */
export type GuessRow = { readonly word: string; readonly marks: readonly Mark[] };

export type WordGuessState = {
  readonly length: number;
  readonly maxGuesses: number;
  readonly phase: WordGuessPhase;
  /** `secrets[seat]` is the word that seat set for the other to guess. */
  readonly secrets: readonly (string | null)[];
  /** `guesses[seat]` are that seat's guesses at the other seat's secret. */
  readonly guesses: readonly (readonly GuessRow[])[];
  /** A seat is finished once it solved, ran out of guesses or gave up. */
  readonly solved: readonly boolean[];
  readonly gaveUp: readonly boolean[];
};

const word = z
  .string()
  .min(MIN_LENGTH)
  .max(MAX_LENGTH)
  .transform((w) => w.toLowerCase())
  .pipe(z.string().regex(/^[a-z]+$/));

export const wordGuessActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("set"), word }),
  z.strictObject({ type: z.literal("guess"), word }),
  z.strictObject({ type: z.literal("give_up") }),
]);

export type WordGuessAction = z.infer<typeof wordGuessActionSchema>;

const violation = (reason: string): RuleError => ({ ok: false, code: "RULE_VIOLATION", reason });
const OK: Ok = { ok: true };

/** The seat whose secret `seat` is guessing. */
export const otherSeat = (seat: number): number => 1 - seat;

export const isFinished = (state: WordGuessState, seat: number): boolean =>
  state.solved[seat] === true ||
  state.gaveUp[seat] === true ||
  (state.guesses[seat]?.length ?? 0) >= state.maxGuesses;

export function setup(config: WordGuessConfig, seats: number): WordGuessState {
  if (seats !== SEATS) throw new RangeError("word guess needs exactly 2 seats");
  return {
    length: config.length,
    maxGuesses: config.maxGuesses,
    phase: "setup",
    secrets: [null, null],
    guesses: [[], []],
    solved: [false, false],
    gaveUp: [false, false],
  };
}

export function createRules(words: WordLists) {
  function validate(state: WordGuessState, seat: number, action: WordGuessAction): Ok | RuleError {
    if (seat !== 0 && seat !== 1) return violation("no_such_seat");
    if (state.phase === "done") return violation("game_over");
    switch (action.type) {
      case "set":
        if (state.phase !== "setup") return violation("wrong_phase");
        if (state.secrets[seat] !== null) return violation("already_set");
        if (action.word.length !== state.length) return violation("wrong_length");
        return words.isCommon(action.word) ? OK : violation("not_a_common_word");
      case "guess":
        if (state.phase !== "guessing") return violation("wrong_phase");
        if (isFinished(state, seat)) return violation("finished");
        if (action.word.length !== state.length) return violation("wrong_length");
        return words.isValid(action.word) ? OK : violation("not_a_word");
      case "give_up":
        if (state.phase !== "guessing") return violation("wrong_phase");
        return isFinished(state, seat) ? violation("finished") : OK;
    }
  }

  function apply(state: WordGuessState, seat: number, action: WordGuessAction): WordGuessState {
    switch (action.type) {
      case "set": {
        const secrets = state.secrets.map((s, i) => (i === seat ? action.word : s));
        return {
          ...state,
          secrets,
          phase: secrets.every((s) => s !== null) ? "guessing" : "setup",
        };
      }
      case "guess": {
        const secret = state.secrets[otherSeat(seat)] as string;
        const marks = feedback(secret, action.word);
        const next: WordGuessState = {
          ...state,
          guesses: state.guesses.map((rows, i) =>
            i === seat ? [...rows, { word: action.word, marks }] : rows,
          ),
          solved: state.solved.map((s, i) => (i === seat ? isSolved(marks) : s)),
        };
        return endIfDone(next);
      }
      case "give_up":
        return endIfDone({
          ...state,
          gaveUp: state.gaveUp.map((g, i) => (i === seat ? true : g)),
        });
    }
  }

  /** Setup: one shared clock. Guessing: only an away player is timed, the one further behind. */
  function nextDeadline(state: WordGuessState): Deadline | null {
    if (state.phase === "done") return null;
    if (state.phase === "setup") {
      return { seat: state.secrets.indexOf(null), at: SETUP_MS, key: "setup" };
    }
    const open = [0, 1].filter((seat) => !isFinished(state, seat));
    const behind = open.sort(
      (a, b) => (state.guesses[a]?.length ?? 0) - (state.guesses[b]?.length ?? 0) || a - b,
    )[0];
    if (behind === undefined) return null;
    const made = state.guesses[behind]?.length ?? 0;
    return {
      seat: behind,
      at: AWAY_GUESS_MS,
      key: `guess:${String(behind)}:${String(made)}`,
      onlyWhenAway: true,
    };
  }

  /** The server picks an everyday word: the secret in setup, a guess while guessing. */
  function autoAction(state: WordGuessState, _seat: number, rng: Rng): WordGuessAction {
    const pick = rng.pick(words.commonOfLength(state.length));
    return state.phase === "setup" ? { type: "set", word: pick } : { type: "guess", word: pick };
  }

  return { validate, apply, nextDeadline, autoAction };
}

function endIfDone(state: WordGuessState): WordGuessState {
  return isFinished(state, 0) && isFinished(state, 1) ? { ...state, phase: "done" } : state;
}

/**
 * Whoever solved in fewer guesses wins; one solver wins; the same number of guesses, or nobody
 * solving, is a draw (no winners, both placed first).
 */
export function result(state: WordGuessState): MatchResult | null {
  if (state.phase !== "done") return null;
  const used = state.guesses.map((rows) => rows.length);
  const score = (seat: number) => (state.solved[seat] === true ? (used[seat] ?? 0) : Infinity);
  const [a, b] = [score(0), score(1)];
  const winners = a === b ? [] : [a < b ? 0 : 1];
  const placements = a === b ? [1, 1] : a < b ? [1, 2] : [2, 1];
  return {
    winners,
    placements,
    details: { guesses: used, solved: [...state.solved] },
  };
}
