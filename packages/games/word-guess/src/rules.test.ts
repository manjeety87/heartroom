import { createRng, replay, startMatch, step } from "@heartroom/engine";
import { assertNoLeak } from "@heartroom/engine/testing";
import { describe, expect, it } from "vitest";
import { CLASSIC_WORD_GUESS, wordGuessConfigSchema } from "./config.ts";
import { feedback } from "./feedback.ts";
import { createWordGuess } from "./module.ts";
import type { WordGuessAction, WordGuessState, WordLists } from "./rules.ts";
import type { WordGuessSeatView, WordGuessSpectatorView } from "./view.ts";

const COMMON = ["apple", "crane", "ghost", "plant", "spoon", "tiger", "lemon", "house"];
const EXTRA = ["papal", "speed", "abide", "evade", "cease"];
const lists: WordLists = {
  isCommon: (w) => COMMON.includes(w),
  isValid: (w) => COMMON.includes(w) || EXTRA.includes(w),
  commonOfLength: (n) => COMMON.filter((w) => w.length === n),
};
const game = createWordGuess(lists);
const seed = new Uint8Array(32).fill(7);

function play(...moves: [number, WordGuessAction][]): WordGuessState {
  let state = startMatch(game, { config: CLASSIC_WORD_GUESS, seats: 2, seed });
  for (const [seat, action] of moves) {
    const next = step(game, state, { seat, action, by: "player" });
    if (!next.ok) throw new Error(`move refused: ${next.reason}`);
    state = next.state;
  }
  return state;
}

const set = (word: string): WordGuessAction => ({ type: "set", word });
const guess = (word: string): WordGuessAction => ({ type: "guess", word });

describe("feedback (two-pass rule)", () => {
  it("APPLE / PAPAL: the second A finds no A left", () => {
    expect(feedback("apple", "papal")).toEqual([
      "present",
      "present",
      "correct",
      "absent",
      "present",
    ]);
  });
  it("SPEED / ABIDE and back", () => {
    expect(feedback("abide", "speed")).toEqual([
      "absent",
      "absent",
      "present",
      "absent",
      "present",
    ]);
    expect(feedback("speed", "abide")).toEqual([
      "absent",
      "absent",
      "absent",
      "present",
      "present",
    ]);
  });
  it("EVADE / CEASE: a correct E uses its copy before a present one is counted", () => {
    expect(feedback("cease", "evade")).toEqual([
      "present",
      "absent",
      "correct",
      "absent",
      "correct",
    ]);
  });
});

describe("word guess rules", () => {
  it("checks secrets against the common list and guesses against the valid list", () => {
    const start = startMatch(game, { config: CLASSIC_WORD_GUESS, seats: 2, seed });
    expect(game.validate(start, 0, set("papal"))).toMatchObject({ reason: "not_a_common_word" });
    expect(game.validate(start, 0, set("pear"))).toMatchObject({ reason: "wrong_length" });
    expect(game.validate(start, 0, guess("apple"))).toMatchObject({ reason: "wrong_phase" });
    const guessing = play([0, set("apple")], [1, set("crane")]);
    expect(guessing.phase).toBe("guessing");
    expect(game.validate(guessing, 0, guess("xxxxx"))).toMatchObject({ reason: "not_a_word" });
    expect(game.validate(guessing, 0, guess("papal"))).toEqual({ ok: true });
  });

  it("lowercases what people type and refuses anything but letters", () => {
    expect(game.actionSchema.parse({ type: "set", word: "APPLE" })).toEqual(set("apple"));
    expect(game.actionSchema.safeParse({ type: "set", word: "app1e" }).success).toBe(false);
  });

  it("fewer guesses wins; the same count is a draw; nobody solving is a draw", () => {
    // Seat 0 guesses "crane" (seat 1's word); seat 1 guesses "apple" (seat 0's word).
    const won = play(
      [0, set("apple")],
      [1, set("crane")],
      [0, guess("crane")],
      [1, guess("ghost")],
      [1, guess("apple")],
    );
    expect(game.result(won)).toMatchObject({ winners: [0], placements: [1, 2] });

    const tie = play(
      [0, set("apple")],
      [1, set("crane")],
      [0, guess("crane")],
      [1, guess("apple")],
    );
    expect(game.result(tie)).toMatchObject({ winners: [], placements: [1, 1] });

    const quits = play(
      [0, set("apple")],
      [1, set("crane")],
      [0, { type: "give_up" }],
      [1, { type: "give_up" }],
    );
    expect(game.result(quits)).toMatchObject({ winners: [], details: { solved: [false, false] } });
  });

  it("a player who runs out of guesses is finished; the game ends when both are", () => {
    const config = wordGuessConfigSchema.parse({ length: 5, maxGuesses: 5 });
    let state = startMatch(game, { config, seats: 2, seed });
    const moves: [number, WordGuessAction][] = [
      [0, set("apple")],
      [1, set("crane")],
      ...["ghost", "plant", "spoon", "tiger", "lemon"].map((w): [number, WordGuessAction] => [
        0,
        guess(w),
      ]),
    ];
    for (const [seat, action] of moves) {
      const next = step(game, state, { seat, action, by: "player" });
      if (!next.ok) throw new Error(next.reason);
      state = next.state;
    }
    expect(game.validate(state, 0, guess("house"))).toMatchObject({ reason: "finished" });
    expect(state.phase).toBe("guessing");
    expect(game.nextDeadline(state)).toMatchObject({ seat: 1, onlyWhenAway: true });
  });

  it("the setter sees the other's guesses at their word; the other secret only at the end", () => {
    const state = play([0, set("apple")], [1, set("crane")], [1, guess("papal")]);
    const mine = game.view(state, { kind: "seat", seat: 0 }) as WordGuessSeatView;
    expect(mine).toMatchObject({ yourSecret: "apple", theirSecret: null, theyHaveSet: true });
    expect(mine.theirGuesses).toEqual([
      { word: "papal", marks: ["present", "present", "correct", "absent", "present"] },
    ]);
    const watcher = game.view(state, { kind: "spectator" }) as WordGuessSpectatorView;
    expect(watcher.rows[1]?.[0]?.word).toBe("");
    expect(watcher.secrets).toBeNull();
    expect(JSON.stringify(watcher)).not.toMatch(/apple|crane|papal/);
  });

  it("the server picks a common word when setup time runs out, and a match replays", () => {
    const auto = createRng(new Uint8Array(32).fill(3));
    let state = startMatch(game, { config: CLASSIC_WORD_GUESS, seats: 2, seed });
    const log = [];
    for (let i = 0; i < 2; i++) {
      const deadline = game.nextDeadline(state);
      if (deadline === null) throw new Error("no setup deadline");
      expect(deadline.key).toBe("setup");
      const entry = {
        seat: deadline.seat,
        action: game.autoAction(state, deadline.seat, auto),
        by: "server" as const,
      };
      const next = step(game, state, entry);
      if (!next.ok) throw new Error(next.reason);
      log.push(entry);
      state = next.state;
    }
    expect(state.phase).toBe("guessing");
    expect(state.secrets.every((s) => s !== null && COMMON.includes(s))).toBe(true);
    expect(replay(game, { config: CLASSIC_WORD_GUESS, seats: 2, seed, actions: log })).toEqual(
      state,
    );
  });

  it("never shows a player the other secret, or a spectator any word, before the end", () => {
    assertNoLeak(game, {
      scenarios: [{ name: "classic", config: CLASSIC_WORD_GUESS, seats: 2 }],
      games: 10,
    });
  });
});
