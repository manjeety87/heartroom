import { roomCodeInput } from "@heartroom/protocol";
import { describe, expect, it } from "vitest";
import { newLinkToken, newRoomCode } from "./codes.ts";

/** Hands out the given byte lists in order, one per call. */
const scripted =
  (...calls: number[][]) =>
  () =>
    Uint8Array.from(calls.shift() ?? []);

describe("newRoomCode", () => {
  it("when nothing is taken, then gives a valid code", () => {
    const code = newRoomCode(() => false);
    expect(roomCodeInput.parse(code)).toBe(code);
  });

  it("when bytes are above 31, then masks them onto the alphabet", () => {
    expect(newRoomCode(() => false, scripted([0, 31, 32, 255, 1, 33]))).toBe("A9A9BB");
  });

  it("when the first code is taken, then tries again", () => {
    const taken = new Set(["AAAAAA"]);
    const code = newRoomCode((c) => taken.has(c), scripted([0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1]));
    expect(code).toBe("BBBBBB");
  });

  it("when every attempt is taken, then throws instead of looping", () => {
    expect(() => newRoomCode(() => true)).toThrow(/No free room code/);
  });
});

describe("newLinkToken", () => {
  it("is 128 bits of url-safe text and differs each time", () => {
    const token = newLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newLinkToken()).not.toBe(token);
  });
});
