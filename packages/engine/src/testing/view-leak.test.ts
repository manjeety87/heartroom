import { describe, expect, it } from "vitest";
import { defineGame } from "../module.ts";
import { assertNoLeak, canonicalJson, LeakError } from "./view-leak.ts";
import { hiddenNumber, type HiddenNumberAction, type HiddenNumberState } from "./hidden-number.ts";

const scenarios = [
  { name: "classic", config: { maxNumber: 10 }, seats: 2 },
  { name: "wide", config: { maxNumber: 30 }, seats: 2 },
];

describe("assertNoLeak", () => {
  it("when a module keeps its secrets, then it passes", () => {
    expect(() => assertNoLeak(hiddenNumber, { scenarios })).not.toThrow();
  });

  it("when a view exposes another seat's secret, then it throws a LeakError", () => {
    const leaky = defineGame({
      ...hiddenNumber,
      view: (state, viewer) => ({
        ...hiddenNumber.view(state, viewer),
        opponent: state.secrets[1],
      }),
    });
    expect(() => assertNoLeak(leaky, { scenarios })).toThrow(
      /the view for seat 0 changes with data it must not see/,
    );
  });

  it("when a view leaks only a derived fact (is it even?), then it still throws", () => {
    const leaky = defineGame({
      ...hiddenNumber,
      view: (state, viewer) => ({
        ...hiddenNumber.view(state, viewer),
        hint: state.secrets[1] % 2 === 0,
      }),
    });
    expect(() => assertNoLeak(leaky, { scenarios, games: 50 })).toThrow(LeakError);
  });

  it("when perturbHidden never changes anything, then it refuses to pass", () => {
    const lazy = defineGame({ ...hiddenNumber, perturbHidden: (state) => state });
    expect(() => assertNoLeak(lazy, { scenarios })).toThrow(/proves nothing/);
  });

  it("when perturbHidden mutates the real state, then it throws", () => {
    const mutating = defineGame({
      ...hiddenNumber,
      perturbHidden: (state: HiddenNumberState) => {
        (state.secrets as [number, number])[1] = -1;
        return state;
      },
    });
    expect(() => assertNoLeak(mutating, { scenarios })).toThrow(/changed the original state/);
  });

  it("when a game never ends, then it fails at the step cap instead of hanging", () => {
    const endless = defineGame({ ...hiddenNumber, apply: (state: HiddenNumberState) => state });
    expect(() => assertNoLeak(endless, { scenarios, maxSteps: 5 })).toThrow(
      /no result after 5 moves/,
    );
  });

  it("when a scenario move is rejected, then it says so", () => {
    const badMove = {
      ...scenarios[0]!,
      nextMove: () => ({ seat: 1, action: { type: "guess", value: 1 } as HiddenNumberAction }),
    };
    expect(() => assertNoLeak(hiddenNumber, { scenarios: [badMove] })).toThrow(
      /move rejected \(not_your_turn\)/,
    );
  });

  it("when a scenario stops early, then the steps so far are still checked", () => {
    const stopAtStart = { ...scenarios[0]!, nextMove: () => null };
    expect(() => assertNoLeak(hiddenNumber, { scenarios: [stopAtStart] })).not.toThrow();
  });

  it("when the module has no deadline before the end, then the default mover stops", () => {
    const noClock = defineGame({ ...hiddenNumber, nextDeadline: () => null });
    expect(() => assertNoLeak(noClock, { scenarios })).not.toThrow();
  });
});

describe("canonicalJson", () => {
  it("sorts keys so key order does not matter", () => {
    expect(canonicalJson({ b: 1, a: [true, null, "x"] }, "t")).toBe(
      canonicalJson({ a: [true, null, "x"], b: 1 }, "t"),
    );
  });

  it.each([[Number.NaN], [undefined], [new Map()], [() => 1]])(
    "refuses %s, which is not plain JSON",
    (value) => {
      expect(() => canonicalJson({ value }, "t")).toThrow(LeakError);
    },
  );
});
