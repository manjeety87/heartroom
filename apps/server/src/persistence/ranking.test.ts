import { describe, expect, it } from "vitest";
import {
  autoPlayedTurns,
  isRankEligible,
  kolkataDayStart,
  pairsOf,
  seatOutcomes,
} from "./ranking.ts";

describe("seatOutcomes", () => {
  it("when one seat wins, then it takes the whole share", () => {
    expect(seatOutcomes(2, { winners: [1], placements: [2, 1], details: null })).toEqual([
      { result: "loss", placement: 2, winShare: 0 },
      { result: "win", placement: 1, winShare: 1 },
    ]);
  });

  it("when k seats share a win, then each gets 1/k", () => {
    const shares = seatOutcomes(3, { winners: [0, 2], placements: [1, 3, 1], details: null });
    expect(shares.map((s) => s.winShare)).toEqual([0.5, 0, 0.5]);
  });

  it("when a match was abandoned, then nobody has a result or a share", () => {
    expect(seatOutcomes(2, null)).toEqual([
      { result: null, placement: null, winShare: 0 },
      { result: null, placement: null, winShare: 0 },
    ]);
  });
});

describe("isRankEligible", () => {
  const ok = {
    status: "finished",
    configIsRanked: true,
    signedInPlayers: 2,
    autoPlayed: [0, 2],
  } as const;

  it("when every condition holds, then the match may be ranked", () => {
    expect(isRankEligible(ok)).toBe(true);
  });

  it("when any condition fails, then it is casual", () => {
    expect(isRankEligible({ ...ok, status: "abandoned" })).toBe(false);
    expect(isRankEligible({ ...ok, configIsRanked: false })).toBe(false);
    expect(isRankEligible({ ...ok, signedInPlayers: 1 })).toBe(false);
    expect(isRankEligible({ ...ok, autoPlayed: [0, 3] })).toBe(false);
  });
});

describe("autoPlayedTurns", () => {
  it("counts only the server's moves, per seat", () => {
    const actions = [
      { seat: 0, by: "player" },
      { seat: 1, by: "server" },
      { seat: 1, by: "server" },
      { seat: 0, by: "server" },
    ] as const;
    expect(autoPlayedTurns(2, actions)).toEqual([1, 2]);
  });
});

describe("kolkataDayStart", () => {
  it("starts the day at midnight in India, whatever the UTC date", () => {
    // 20:00 UTC on the 12th is 01:30 on the 13th in India.
    expect(kolkataDayStart(new Date("2026-11-12T20:00:00Z")).toISOString()).toBe(
      "2026-11-12T18:30:00.000Z",
    );
    expect(kolkataDayStart(new Date("2026-11-12T18:29:59Z")).toISOString()).toBe(
      "2026-11-11T18:30:00.000Z",
    );
  });
});

describe("pairsOf", () => {
  it("lists every pair once, smaller id first", () => {
    expect(pairsOf(["c", "a", "b", "a"])).toEqual([
      ["a", "b"],
      ["a", "c"],
      ["b", "c"],
    ]);
  });
});
