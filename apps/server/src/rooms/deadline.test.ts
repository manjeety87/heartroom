import type { Deadline } from "@heartroom/engine";
import { describe, expect, it } from "vitest";
import { msUntilDue, trackDeadline } from "./deadline.ts";

const turn = (key: string, extra: Partial<Deadline> = {}): Deadline => ({
  seat: 0,
  at: 15_000,
  key,
  ...extra,
});

describe("trackDeadline + msUntilDue", () => {
  it("when the key stays the same, then the clock keeps running from its first sighting", () => {
    const clock = trackDeadline(null, turn("setup"), 1_000, false);
    const later = trackDeadline(clock, turn("setup", { seat: 1 }), 9_000, false);
    expect(later).toBe(clock);
    expect(msUntilDue(later!, turn("setup"), 9_000)).toBe(7_000);
  });

  it("when the key changes, then a fresh clock starts", () => {
    const clock = trackDeadline(null, turn("turn:0"), 0, false);
    const next = trackDeadline(clock, turn("turn:1"), 20_000, false);
    expect(msUntilDue(next!, turn("turn:1"), 20_000)).toBe(15_000);
  });

  it("when there is no deadline, then there is no clock", () => {
    expect(trackDeadline(null, null, 0, false)).toBeNull();
  });

  it("when a deadline runs only while away, then connected time does not count", () => {
    const away = turn("turn:3", { onlyWhenAway: true });
    let clock = trackDeadline(null, away, 0, false)!;
    expect(msUntilDue(clock, away, 60_000)).toBeNull();
    clock = trackDeadline(clock, away, 60_000, true)!; // drops
    expect(msUntilDue(clock, away, 65_000)).toBe(10_000);
    clock = trackDeadline(clock, away, 65_000, false)!; // back: 5 s banked
    expect(msUntilDue(clock, away, 90_000)).toBeNull();
    clock = trackDeadline(clock, away, 90_000, true)!; // drops again
    expect(msUntilDue(clock, away, 100_000)).toBe(0);
  });
});
