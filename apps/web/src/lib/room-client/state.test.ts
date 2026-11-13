import type { RoomMessage } from "@heartroom/protocol";
import { describe, expect, it } from "vitest";
import { applyServerMessage, closedReasonFor, INITIAL_STATE, type RoomState } from "./state.ts";

const room = (phase: RoomMessage["phase"]): RoomMessage => ({
  type: "room",
  code: "ABCDEF",
  hostId: "u1",
  isLocked: false,
  phase,
  gameId: "bingo",
  seats: [],
  spectators: [],
});

const live: RoomState = { ...INITIAL_STATE, status: "live", me: "u1" };

describe("applyServerMessage", () => {
  it("when views arrive out of order, then keeps the newest", () => {
    let state = applyServerMessage(live, { type: "game", seq: 3, view: "three" }, 0);
    state = applyServerMessage(state, { type: "game", seq: 2, view: "two" }, 0);
    expect(state.game).toEqual({ seq: 3, view: "three" });
    state = applyServerMessage(state, { type: "game", seq: 3, view: "three again" }, 0);
    expect(state.game?.view).toBe("three again");
  });

  it("when a new game starts, then the last game's view no longer outranks seq 0", () => {
    let state = applyServerMessage(live, room("playing"), 0);
    state = applyServerMessage(state, { type: "game", seq: 9, view: "old" }, 0);
    state = applyServerMessage(state, room("results"), 0);
    expect(state.game?.view).toBe("old"); // results still show the finished game
    state = applyServerMessage(state, room("playing"), 0);
    state = applyServerMessage(state, { type: "game", seq: 0, view: "new" }, 0);
    expect(state.game).toEqual({ seq: 0, view: "new" });
  });

  it("when an intent is acked, then it leaves the outbox; when one is refused, all pending go", () => {
    const pending = [
      { clientActionId: "a", turnSeq: 1, action: {} },
      { clientActionId: "b", turnSeq: 1, action: {} },
    ];
    let state = applyServerMessage(
      { ...live, outbox: pending },
      { type: "ack", clientActionId: "a" },
      0,
    );
    expect(state.outbox.map((p) => p.clientActionId)).toEqual(["b"]);
    state = applyServerMessage(state, { type: "error", code: "NOT_YOUR_TURN", message: "x" }, 0);
    expect(state.outbox).toEqual([]);
    expect(state.notice).toEqual({ id: 1, code: "NOT_YOUR_TURN" });
    state = applyServerMessage(state, { type: "error", code: "NOT_YOUR_TURN", message: "x" }, 0);
    expect(state.notice?.id).toBe(2);
  });

  it("when the game moves on after a refusal, then the refusal is cleared; a resent view keeps it", () => {
    let state = applyServerMessage(live, { type: "game", seq: 4, view: "v" }, 0);
    state = applyServerMessage(state, { type: "error", code: "STALE_TURN", message: "x" }, 0);
    state = applyServerMessage(state, { type: "game", seq: 4, view: "v" }, 0);
    expect(state.notice?.code).toBe("STALE_TURN");
    state = applyServerMessage(state, { type: "game", seq: 5, view: "w" }, 0);
    expect(state.notice).toBeNull();
  });
});

describe("closedReasonFor", () => {
  it("names our own leave, the server's reasons, and anything else as a lost connection", () => {
    expect(closedReasonFor(4000, true)).toBe("left");
    expect(closedReasonFor(4102, false)).toBe("kicked");
    expect(closedReasonFor(4104, false)).toBe("taken_over");
    expect(closedReasonFor(1006, false)).toBe("lost");
  });
});

describe("checkpoints", () => {
  it("keeps only the newest checkpoint", () => {
    let state = applyServerMessage(live, { type: "checkpoint", checkpoint: "c1.one" }, 0);
    state = applyServerMessage(state, { type: "checkpoint", checkpoint: "c1.two" }, 0);
    expect(state.checkpoint).toBe("c1.two");
  });
});

describe("turn clock", () => {
  it("turns time left into an end time on this device, and keeps a paused clock paused", () => {
    let state = applyServerMessage(
      live,
      { type: "deadline", deadline: { seat: 1, key: "turn:3", msLeft: 9_000, totalMs: 15_000 } },
      1_000,
    );
    expect(state.deadline).toEqual({ seat: 1, key: "turn:3", endsAt: 10_000, totalMs: 15_000 });
    state = applyServerMessage(
      state,
      { type: "deadline", deadline: { seat: 1, key: "turn:3", msLeft: null, totalMs: 15_000 } },
      2_000,
    );
    expect(state.deadline?.endsAt).toBeNull();
    state = applyServerMessage(state, { type: "deadline", deadline: null }, 3_000);
    expect(state.deadline).toBeNull();
  });
});
