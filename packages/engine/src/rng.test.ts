import { describe, expect, it } from "vitest";
import { createRng, newSeed, SEED_BYTES } from "./rng.ts";

const seedOf = (...words: number[]): Uint8Array => {
  const seed = new Uint8Array(SEED_BYTES);
  const view = new DataView(seed.buffer);
  words.forEach((w, i) => view.setUint32(i * 4, w, true));
  return seed;
};

describe("createRng", () => {
  it("when seeded with state 1,2,3,4, then it matches the xoshiro128** reference outputs", () => {
    const rng = createRng(seedOf(1, 2, 3, 4));
    expect([rng.next(), rng.next(), rng.next()]).toEqual([11520, 0, 5927040]);
  });

  it("when two rngs share a seed, then they produce the same sequence", () => {
    const a = createRng(seedOf(7, 8, 9));
    const b = createRng(seedOf(7, 8, 9));
    expect(Array.from({ length: 50 }, () => a.next())).toEqual(
      Array.from({ length: 50 }, () => b.next()),
    );
  });

  it("when the second half of the seed differs, then the sequence differs", () => {
    const a = createRng(seedOf(1, 2, 3, 4));
    const b = createRng(seedOf(1, 2, 3, 4, 0, 5));
    expect(a.next()).not.toBe(b.next());
  });

  it("when the seed is all zeros, then it still produces varied output", () => {
    const rng = createRng(new Uint8Array(SEED_BYTES));
    const values = new Set(Array.from({ length: 20 }, () => rng.next()));
    expect(values.size).toBeGreaterThan(15);
  });

  it("when the seed has the wrong length, then it throws", () => {
    expect(() => createRng(new Uint8Array(16))).toThrow(RangeError);
  });
});

describe("int", () => {
  it("when sampled 1M times over 10 values, then the distribution passes a chi-square test", () => {
    const rng = createRng(seedOf(42));
    const counts = new Array<number>(10).fill(0);
    const samples = 1_000_000;
    for (let i = 0; i < samples; i++) {
      const v = rng.int(0, 9);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    const expected = samples / 10;
    const chiSquare = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    // 9 degrees of freedom, p = 0.001 → 27.88.
    expect(chiSquare).toBeLessThan(27.88);
  });

  it("when min equals max, then it returns that value", () => {
    expect(createRng(seedOf(3)).int(5, 5)).toBe(5);
  });

  it("when the range is the full 32 bits, then values stay in range", () => {
    const rng = createRng(seedOf(3));
    const v = rng.int(-(2 ** 31), 2 ** 31 - 1);
    expect(v).toBeGreaterThanOrEqual(-(2 ** 31));
    expect(v).toBeLessThanOrEqual(2 ** 31 - 1);
  });

  it("when the range needs rejection, then it still returns values in range", () => {
    const rng = createRng(seedOf(3));
    // A range just over half of 2^32 rejects almost half of all raw values.
    const max = 2 ** 31 + 1;
    for (let i = 0; i < 200; i++) expect(rng.int(0, max)).toBeLessThanOrEqual(max);
  });

  it.each([
    [1.5, 2],
    [3, 1],
    [0, 2 ** 32],
    [Number.NaN, 1],
  ])("when called with (%s, %s), then it throws", (min, max) => {
    expect(() => createRng(seedOf(1)).int(min, max)).toThrow(RangeError);
  });
});

describe("shuffle and pick", () => {
  it("when shuffling, then it returns a permutation and leaves the input alone", () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const out = createRng(seedOf(9)).shuffle(input);
    expect([...out].sort((a, b) => a - b)).toEqual([...input]);
    expect(out).not.toEqual([...input]);
  });

  it("when shuffling an empty array, then it returns an empty array", () => {
    expect(createRng(seedOf(9)).shuffle([])).toEqual([]);
  });

  it("when picking, then the item comes from the array", () => {
    expect(["a", "b", "c"]).toContain(createRng(seedOf(9)).pick(["a", "b", "c"]));
  });

  it("when picking from an empty array, then it throws", () => {
    expect(() => createRng(seedOf(9)).pick([])).toThrow(RangeError);
  });
});

describe("newSeed", () => {
  it("returns 32 fresh random bytes each call", () => {
    const a = newSeed();
    expect(a).toHaveLength(SEED_BYTES);
    expect(a).not.toEqual(newSeed());
  });
});
