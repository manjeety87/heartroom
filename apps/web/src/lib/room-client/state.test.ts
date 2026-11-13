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
    let state = applyServerMessage(live, { type: "game", seq: 3, view: "three" });
    state = applyServerMessage(state, { type: "game", seq: 2, view: "two" });
    expect(state.game).toEqual({ seq: 3, view: "three" });
    state = applyServerMessage(state, { type: "game", seq: 3, view: "three again" });
    expect(state.game?.view).toBe("three again");
  });

  it("when a new game starts, then the last game's view no longer outranks seq 0", () => {
    let state = applyServerMessage(live, room("playing"));
    state = applyServerMessage(state, { type: "game", seq: 9, view: "old" });
    state = applyServerMessage(state, room("results"));
    expect(state.game?.view).toBe("old"); // results still show the finished game
    state = applyServerMessage(state, room("playing"));
    state = applyServerMessage(state, { type: "game", seq: 0, view: "new" });
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
    );
    expect(state.outbox.map((p) => p.clientActionId)).toEqual(["b"]);
    state = applyServerMessage(state, { type: "error", code: "NOT_YOUR_TURN", message: "x" });
    expect(state.outbox).toEqual([]);
    expect(state.notice).toEqual({ id: 1, code: "NOT_YOUR_TURN" });
    state = applyServerMessage(state, { type: "error", code: "NOT_YOUR_TURN", message: "x" });
    expect(state.notice?.id).toBe(2);
  });

  it("when the game moves on after a refusal, then the refusal is cleared; a resent view keeps it", () => {
    let state = applyServerMessage(live, { type: "game", seq: 4, view: "v" });
    state = applyServerMessage(state, { type: "error", code: "STALE_TURN", message: "x" });
    state = applyServerMessage(state, { type: "game", seq: 4, view: "v" });
    expect(state.notice?.code).toBe("STALE_TURN");
    state = applyServerMessage(state, { type: "game", seq: 5, view: "w" });
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
    let state = applyServerMessage(live, { type: "checkpoint", checkpoint: "c1.one" });
    state = applyServerMessage(state, { type: "checkpoint", checkpoint: "c1.two" });
    expect(state.checkpoint).toBe("c1.two");
  });
});
