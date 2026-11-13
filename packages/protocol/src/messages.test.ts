import { describe, expect, it } from "vitest";
import { CLOSE_CODES, ERROR_CODES, ERROR_MESSAGES } from "./errors.ts";
import { clientMessage, LIMITS, nicknameInput, serverMessage } from "./messages.ts";

describe("clientMessage", () => {
  it.each([
    { type: "intent", clientActionId: "a1", turnSeq: 3, action: { type: "call", n: 7 } },
    { type: "resync" },
    { type: "resume", checkpoint: "abc" },
    { type: "host", kind: "start" },
    { type: "host", kind: "kick", target: "user_1" },
    { type: "host", kind: "config", gameId: "bingo", config: { size: 5 } },
    { type: "voice_token" },
    { type: "rematch_ready" },
  ])("when the message is well formed, then it parses (%o)", (message) => {
    expect(clientMessage.safeParse(message).success).toBe(true);
  });

  it.each([
    ["an unknown type", { type: "cheat" }],
    ["an extra field", { type: "resync", seat: 2 }],
    ["a negative turnSeq", { type: "intent", clientActionId: "a", turnSeq: -1, action: null }],
    [
      "an over-long id",
      { type: "intent", clientActionId: "x".repeat(LIMITS.ID_CHARS + 1), turnSeq: 0, action: null },
    ],
    ["no target on kick", { type: "host", kind: "kick" }],
    ["a target on start", { type: "host", kind: "start", target: "u" }],
    [
      "an over-long checkpoint",
      { type: "resume", checkpoint: "x".repeat(LIMITS.CHECKPOINT_CHARS + 1) },
    ],
  ])("when the message has %s, then it is rejected", (_, message) => {
    expect(clientMessage.safeParse(message).success).toBe(false);
  });
});

describe("serverMessage", () => {
  const room = {
    type: "room",
    code: "AB23CD",
    hostId: "u1",
    isLocked: false,
    phase: "lobby",
    gameId: null,
    seats: [{ seat: 0, userId: "u1", nickname: "Mann", isConnected: true }],
    spectators: [],
  };
  const emptySeat = (seat: number) => ({ seat, userId: null, nickname: null, isConnected: false });

  it.each([
    room,
    { type: "game", seq: 4, view: { anything: true } },
    { type: "ack", clientActionId: "a1" },
    { type: "error", code: "NOT_YOUR_TURN", message: ERROR_MESSAGES.NOT_YOUR_TURN },
    { type: "voice_token", token: "t", url: "wss://voice.example.com" },
    { type: "knock", knockId: "k1", nickname: "Asha" },
  ])("when the message is well formed, then it parses (%o)", (message) => {
    expect(serverMessage.safeParse(message).success).toBe(true);
  });

  it.each([
    ["an unknown error code", { type: "error", code: "OOPS", message: "x" }],
    ["a non-websocket voice url", { type: "voice_token", token: "t", url: "https://x.com" }],
    ["too many seats", { ...room, seats: Array.from({ length: 7 }, (_, i) => emptySeat(i)) }],
    ["a nickname over 20 characters", { type: "knock", knockId: "k", nickname: "x".repeat(21) }],
  ])("when the message has %s, then it is rejected", (_, message) => {
    expect(serverMessage.safeParse(message).success).toBe(false);
  });
});

describe("nicknameInput", () => {
  it.each([
    ["  Riya  ", "Riya"],
    ["Aarav   Kumar", "Aarav Kumar"],
    ["émile", "émile"],
    ["मन", "मन"],
  ])("when given %j, then it becomes %j", (input, output) => {
    expect(nicknameInput.parse(input)).toBe(output);
  });

  it.each([[""], ["   "], ["x".repeat(21)], ["!!!"]])(
    "when given %j, then it is refused",
    (input) => {
      expect(nicknameInput.safeParse(input).success).toBe(false);
    },
  );
});

describe("codes", () => {
  it("has safe copy for every error code", () => {
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual(Object.values(ERROR_CODES).sort());
  });

  it("keeps close codes unique, in the application range and clear of Colyseus's own", () => {
    const codes = Object.values(CLOSE_CODES);
    expect(new Set(codes).size).toBe(codes.length);
    // Colyseus 0.18 uses CONSENTED 4000, SERVER_SHUTDOWN 4001, WITH_ERROR 4002,
    // FAILED_TO_RECONNECT 4003 and MAY_TRY_RECONNECT 4010.
    for (const code of codes) {
      expect(code).toBeGreaterThanOrEqual(4100);
      expect(code).toBeLessThan(5000);
    }
  });
});
