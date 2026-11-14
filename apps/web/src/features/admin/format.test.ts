import { describe, expect, it } from "vitest";
import { formatCount, formatDuration, formatPercent } from "./format.ts";

describe("formatDuration", () => {
  it("picks the largest unit that keeps the cell short", () => {
    expect(formatDuration(-5)).toBe("0 s");
    expect(formatDuration(59_999)).toBe("59 s");
    expect(formatDuration(60_000)).toBe("1 min");
    expect(formatDuration(3 * 3_600_000 + 5 * 60_000)).toBe("3 h 05 min");
    expect(formatDuration(52 * 3_600_000)).toBe("2 d 4 h");
  });
});

describe("formatCount / formatPercent", () => {
  it("keeps whole numbers whole and rounds rates", () => {
    expect(formatCount(3)).toBe("3");
    expect(formatCount(1.5)).toBe("1.50");
    expect(formatPercent(0.254)).toBe("25%");
  });
});
