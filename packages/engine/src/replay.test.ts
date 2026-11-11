import { describe, expect, it } from "vitest";
import { createRng, SEED_BYTES } from "./rng.ts";
import { replay, ReplayError, startMatch } from "./replay.ts";
import { step, type LogEntry } from "./step.ts";
import { hiddenNumber, type HiddenNumberAction } from "./testing/hidden-number.ts";

const seed = new Uint8Array(SEED_BYTES).fill(7);
const match = { config: { maxNumber: 10 }, seats: 2, seed };

/** Plays a whole game the way the room will: deadline seat, auto action, `step`. */
function playToEnd() {
  const rng = createRng(new Uint8Array(SEED_BYTES).fill(3));
  let state = startMatch(hiddenNumber, match);
  const actions: LogEntry<HiddenNumberAction>[] = [];
  for (
    let deadline = hiddenNumber.nextDeadline(state);
    deadline;
    deadline = hiddenNumber.nextDeadline(state)
  ) {
    const entry = {
      seat: deadline.seat,
      action: hiddenNumber.autoAction(state, deadline.seat, rng),
      by: "server" as const,
    };
    const result = step(hiddenNumber, state, entry);
    if (!result.ok) throw new Error(result.reason);
    state = result.state;
    actions.push(entry);
  }
  return { state, actions };
}

describe("step", () => {
  it("when the action is valid, then it returns the applied state", () => {
    const state = startMatch(hiddenNumber, match);
    const result = step(hiddenNumber, state, {
      seat: 0,
      action: { type: "guess", value: 1 },
      by: "player",
    });
    expect(result.ok && result.state.guesses).toHaveLength(1);
  });

  it("when the action breaks a rule, then it returns the rule error and leaves the state alone", () => {
    const state = startMatch(hiddenNumber, match);
    const before = JSON.stringify(state);
    const result = step(hiddenNumber, state, {
      seat: 1,
      action: { type: "guess", value: 1 },
      by: "player",
    });
    expect(result).toEqual({ ok: false, code: "NOT_YOUR_TURN", reason: "not_your_turn" });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("replay", () => {
  it("when a finished match is replayed from its log, then it reaches the same final state", () => {
    const { state, actions } = playToEnd();
    expect(hiddenNumber.result(state)).not.toBeNull();
    expect(replay(hiddenNumber, { ...match, actions })).toEqual(state);
  });

  it("when the log is empty, then it returns the initial state", () => {
    expect(replay(hiddenNumber, { ...match, actions: [] })).toEqual(
      startMatch(hiddenNumber, match),
    );
  });

  it("when the same seed starts two matches, then their secrets match", () => {
    expect(startMatch(hiddenNumber, match)).toEqual(startMatch(hiddenNumber, match));
  });

  it("when a logged action is rejected, then it throws a ReplayError with its index", () => {
    const { actions } = playToEnd();
    const broken = [...actions, actions[0] as LogEntry<HiddenNumberAction>];
    const error: unknown = (() => {
      try {
        replay(hiddenNumber, { ...match, actions: broken });
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ReplayError);
    expect((error as ReplayError).index).toBe(actions.length);
    expect((error as ReplayError).message).toContain("game_over");
  });
});
