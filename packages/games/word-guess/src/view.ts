import type { Rng, Viewer } from "@heartroom/engine";
import type { Mark } from "./feedback.ts";
import {
  otherSeat,
  isFinished,
  type GuessRow,
  type WordGuessPhase,
  type WordGuessState,
} from "./rules.ts";

type Row = { readonly word: string; readonly marks: readonly Mark[] };

/**
 * A player's view. They see their own secret, their guesses at the other word, and the other
 * player's guesses at their own word live (CUJ 8: the setter watches). The other secret appears
 * only once the game is done.
 */
export type WordGuessSeatView = {
  readonly kind: "seat";
  readonly phase: WordGuessPhase;
  readonly length: number;
  readonly maxGuesses: number;
  readonly you: number;
  readonly yourSecret: string | null;
  readonly theyHaveSet: boolean;
  readonly yourGuesses: readonly Row[];
  readonly theirGuesses: readonly Row[];
  readonly youFinished: boolean;
  readonly theyFinished: boolean;
  /** Null until the game is done. */
  readonly theirSecret: string | null;
};

/**
 * A spectator sees the pattern of marks only, never letters, until the end: guessed words and marks
 * together would spell out the secrets for anyone on voice to repeat.
 */
export type WordGuessSpectatorView = {
  readonly kind: "spectator";
  readonly phase: WordGuessPhase;
  readonly length: number;
  readonly maxGuesses: number;
  readonly hasSet: readonly boolean[];
  /** `rows[seat]`: that seat's guesses; `word` is empty until the game is done. */
  readonly rows: readonly (readonly Row[])[];
  readonly finished: readonly boolean[];
  /** Null until the game is done. */
  readonly secrets: readonly (string | null)[] | null;
};

export type WordGuessView = WordGuessSeatView | WordGuessSpectatorView;

const copyRows = (rows: readonly GuessRow[] | undefined, showWords: boolean): Row[] =>
  (rows ?? []).map((r) => ({ word: showWords ? r.word : "", marks: [...r.marks] }));

export function view(state: WordGuessState, viewer: Viewer): WordGuessView {
  const isDone = state.phase === "done";
  if (viewer.kind === "spectator") {
    return {
      kind: "spectator",
      phase: state.phase,
      length: state.length,
      maxGuesses: state.maxGuesses,
      hasSet: state.secrets.map((s) => s !== null),
      rows: state.guesses.map((rows) => copyRows(rows, isDone)),
      finished: [isFinished(state, 0), isFinished(state, 1)],
      secrets: isDone ? [...state.secrets] : null,
    };
  }
  const you = viewer.seat;
  const them = otherSeat(you);
  return {
    kind: "seat",
    phase: state.phase,
    length: state.length,
    maxGuesses: state.maxGuesses,
    you,
    yourSecret: state.secrets[you] ?? null,
    theyHaveSet: state.secrets[them] !== null,
    yourGuesses: copyRows(state.guesses[you], true),
    theirGuesses: copyRows(state.guesses[them], true),
    youFinished: isFinished(state, you),
    theyFinished: isFinished(state, them),
    theirSecret: isDone ? (state.secrets[them] ?? null) : null,
  };
}

/** A different word of the same length, letter by letter, for `perturbHidden`. */
function otherWord(word: string, rng: Rng): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  // Words are a–z only (the action schema), so indexing by code unit is safe.
  return Array.from({ length: word.length }, (_, i) => {
    let next = word[i];
    while (next === word[i]) next = letters[rng.int(0, letters.length - 1)];
    return next;
  }).join("");
}

/**
 * Test-only: everything this viewer must not know is changed. A player must not know the other
 * secret (their own marks were worked out when guessed, so they stay); a spectator must know no
 * secret and no guessed word.
 */
export function perturbHidden(state: WordGuessState, viewer: Viewer, rng: Rng): WordGuessState {
  if (state.phase === "done") return state;
  if (viewer.kind === "seat") {
    const them = otherSeat(viewer.seat);
    return {
      ...state,
      secrets: state.secrets.map((s, seat) =>
        seat === them && s !== null ? otherWord(s, rng) : s,
      ),
    };
  }
  return {
    ...state,
    secrets: state.secrets.map((s) => (s === null ? s : otherWord(s, rng))),
    guesses: state.guesses.map((rows) => rows.map((r) => ({ ...r, word: otherWord(r.word, rng) }))),
  };
}
