import { CLASSIC, bingo } from "@heartroom/bingo";
import { newSeed } from "@heartroom/engine";
import { describe, expect, it } from "vitest";
import { prepareMatch } from "./match.ts";

/** Two grids that share no run of numbers, so finding one inside the other's view means a leak. */
const ascending = Array.from({ length: 25 }, (_, i) => i + 1);
const grid = (which: 1 | 2) => (which === 1 ? ascending : [...ascending].reverse());

describe("prepareMatch", () => {
  it("when the config doesn't fit the game, then refuses it", () => {
    expect(prepareMatch(bingo, { size: 99 })).toBeNull();
  });

  it("when a config names a seat the match won't have, then start throws", () => {
    const setup = prepareMatch(bingo, { ...CLASSIC, firstSeat: 4 })!;
    expect(() => setup.start(2, newSeed())).toThrow(RangeError);
  });

  it("when players act, then actions are parsed, validated and counted", () => {
    const match = prepareMatch(bingo, CLASSIC)!.start(2, newSeed());
    expect(match.play(0, { type: "dance" })).toEqual({ ok: false, code: "INVALID_MESSAGE" });
    expect(match.play(0, { type: "call", n: 1 })).toEqual({ ok: false, code: "RULE_VIOLATION" });
    expect(match.play(0, { type: "fill", grid: grid(1) })).toEqual({ ok: true });
    expect(match.turnSeq()).toBe(1);
  });

  it("when a deadline passes, then the server's move is legal and keeps the game going", () => {
    const match = prepareMatch(bingo, CLASSIC)!.start(2, newSeed());
    for (let i = 0; i < 4; i++) match.autoPlay(match.deadline()!.seat); // fill + ready, both seats
    expect(match.view({ kind: "spectator" })).toMatchObject({ phase: "playing" });
    match.autoPlay(match.deadline()!.seat);
    expect(match.view({ kind: "spectator" })).toMatchObject({ called: [expect.any(Number)] });
  });

  it("only ever shows a seat its own grid", () => {
    const match = prepareMatch(bingo, CLASSIC)!.start(2, newSeed());
    match.play(0, { type: "fill", grid: grid(1) });
    match.play(1, { type: "fill", grid: grid(2) });
    expect(match.view({ kind: "seat", seat: 1 })).toMatchObject({ grid: grid(2) });
    expect(JSON.stringify(match.view({ kind: "seat", seat: 1 }))).not.toContain(
      JSON.stringify(grid(1)),
    );
  });

  it("when players act at once inside one turn, then their intents are not stale", () => {
    const match = prepareMatch(bingo, CLASSIC)!.start(2, newSeed());
    match.play(0, { type: "fill", grid: grid(1) });
    expect(match.isStale(0)).toBe(false); // seat 1 filled from the view at seq 0: still "setup"
  });

  it("when the turn has moved on, then an intent from before it is stale", () => {
    const match = prepareMatch(bingo, CLASSIC)!.start(2, newSeed());
    match.play(0, { type: "fill", grid: grid(1) });
    match.play(1, { type: "fill", grid: grid(2) });
    match.play(0, { type: "ready" });
    match.play(1, { type: "ready" }); // now "turn:0"
    expect(match.isStale(3)).toBe(true);
    expect(match.isStale(4)).toBe(false);
    match.play(0, { type: "call", n: 1 }); // now "turn:1"
    expect(match.isStale(4)).toBe(true);
    expect(match.isStale(99)).toBe(true);
  });

  it("when a match is restored from its record, then every view is the same as before", () => {
    const setup = prepareMatch(bingo, CLASSIC)!;
    const match = setup.start(2, newSeed());
    match.play(0, { type: "fill", grid: grid(1) });
    for (let i = 0; i < 6; i++) match.autoPlay(match.deadline()!.seat);
    const { seed, actions } = match.record();
    // Through JSON, as a checkpoint carries it.
    const restored = setup.restore(2, seed, JSON.parse(JSON.stringify(actions)) as typeof actions)!;
    expect(restored.turnSeq()).toBe(match.turnSeq());
    for (const viewer of [
      { kind: "seat", seat: 0 },
      { kind: "seat", seat: 1 },
      { kind: "spectator" },
    ] as const) {
      expect(JSON.stringify(restored.view(viewer))).toBe(JSON.stringify(match.view(viewer)));
    }
    expect(restored.isStale(match.turnSeq())).toBe(false);
  });

  it("when a record holds a move the rules refuse, then nothing is restored", () => {
    const setup = prepareMatch(bingo, CLASSIC)!;
    const bad = [{ seat: 0, action: { type: "call", n: 1 }, by: "player" as const }];
    expect(setup.restore(2, newSeed(), bad)).toBeNull();
    expect(
      setup.restore(2, newSeed(), [{ seat: 0, action: { type: "dance" }, by: "player" }]),
    ).toBeNull();
    expect(setup.restore(9, newSeed(), [])).toBeNull();
  });
});
