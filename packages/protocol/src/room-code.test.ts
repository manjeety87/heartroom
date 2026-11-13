import { describe, expect, it } from "vitest";
import { ROOM_CODE_ALPHABET, roomCodeInput } from "./room-code.ts";

describe("roomCodeInput", () => {
  it("when typed in lower case with spaces and a dash, then gives the canonical code", () => {
    expect(roomCodeInput.parse(" ab3 k-9q ")).toBe("AB3K9Q");
  });

  it("when a look-alike symbol is used, then refuses it", () => {
    for (const bad of ["AB0K9Q", "ABOK9Q", "AB1K9Q", "ABIK9Q"]) {
      expect(roomCodeInput.safeParse(bad).success).toBe(false);
    }
  });

  it("when too short, too long or oversized, then refuses it", () => {
    expect(roomCodeInput.safeParse("AB3K9").success).toBe(false);
    expect(roomCodeInput.safeParse("AB3K9QA").success).toBe(false);
    expect(roomCodeInput.safeParse("A".repeat(33)).success).toBe(false);
  });

  it("has 32 distinct symbols", () => {
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(32);
  });
});
