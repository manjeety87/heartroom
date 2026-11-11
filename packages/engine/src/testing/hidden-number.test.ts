import { describe, expect, it } from "vitest";
import { createRng, SEED_BYTES } from "../rng.ts";
import { hiddenNumber, type HiddenNumberState } from "./hidden-number.ts";

const rng = () => createRng(new Uint8Array(SEED_BYTES).fill(5));
const base: HiddenNumberState = {
  maxNumber: 10,
  secrets: [3, 8],
  turn: 0,
  guesses: [],
  winner: null,
};
const guess = (value: number) => ({ type: "guess" as const, value });

describe("hidden-number fixture", () => {
  it("when set up with a seat count other than 2, then it throws", () => {
    expect(() => hiddenNumber.setup({ maxNumber: 10 }, 3, rng())).toThrow(RangeError);
  });

  it("when set up, then both secrets are within range and seat 0 starts", () => {
    const state = hiddenNumber.setup({ maxNumber: 10 }, 2, rng());
    expect(state.turn).toBe(0);
    for (const s of state.secrets) expect(s).toBeGreaterThanOrEqual(1);
    for (const s of state.secrets) expect(s).toBeLessThanOrEqual(10);
  });

  it.each([
    [{ ...base, winner: 0 }, 0, 1, "game_over"],
    [base, 1, 1, "not_your_turn"],
    [base, 0, 11, "out_of_range"],
    [
      { ...base, guesses: [{ seat: 0, value: 4, feedback: "higher" as const }] },
      0,
      4,
      "already_guessed",
    ],
  ])("when the move breaks a rule, then validate names it (%#)", (state, seat, value, reason) => {
    const verdict = hiddenNumber.validate(state, seat, guess(value));
    expect(!verdict.ok && verdict.reason).toBe(reason);
  });

  it("when a guess is low or high, then the feedback points the right way and the turn passes", () => {
    const low = hiddenNumber.apply(base, 0, guess(2));
    expect(low.guesses.at(-1)?.feedback).toBe("higher");
    expect(low.turn).toBe(1);
    const high = hiddenNumber.apply(low, 1, guess(9));
    expect(high.guesses.at(-1)?.feedback).toBe("lower");
  });

  it("when a guess hits, then the guesser wins, the clock stops and the secrets are revealed", () => {
    const won = hiddenNumber.apply(base, 0, guess(8));
    expect(won.winner).toBe(0);
    expect(hiddenNumber.nextDeadline(won)).toBeNull();
    expect(hiddenNumber.result(won)).toEqual({
      winners: [0],
      placements: [1, 2],
      details: { guesses: 1 },
    });
    expect(hiddenNumber.view(won, { kind: "spectator" }).reveal).toEqual([3, 8]);
  });

  it("when the game is running, then a seat sees only its own secret and a spectator none", () => {
    expect(hiddenNumber.view(base, { kind: "seat", seat: 1 })).toMatchObject({
      yourSecret: 8,
      reveal: null,
    });
    expect(hiddenNumber.view(base, { kind: "spectator" })).toMatchObject({
      you: null,
      yourSecret: null,
    });
    expect(hiddenNumber.result(base)).toBeNull();
  });

  it("when auto-playing, then it never repeats a guess", () => {
    const tried = {
      ...base,
      maxNumber: 3,
      guesses: [1, 2].map((value) => ({ seat: 0, value, feedback: "higher" as const })),
    };
    expect(hiddenNumber.autoAction(tried, 0, rng())).toEqual(guess(3));
  });

  it("when perturbing for a seat, then only the other seat's secret may change, and nothing after the end", () => {
    const perturbed = hiddenNumber.perturbHidden(base, { kind: "seat", seat: 0 }, rng());
    expect(perturbed.secrets[0]).toBe(3);
    const over = { ...base, winner: 1 };
    expect(hiddenNumber.perturbHidden(over, { kind: "spectator" }, rng())).toBe(over);
  });

  it("parses actions and configs strictly", () => {
    expect(hiddenNumber.actionSchema.safeParse({ type: "guess", value: 4, extra: 1 }).success).toBe(
      false,
    );
    expect(hiddenNumber.configSchema.safeParse({ maxNumber: 1 }).success).toBe(false);
  });
});
