import { describe, expect, it } from "vitest";
import { MAX_LENGTH, MIN_LENGTH } from "../config.ts";
import { loadEnglishWords } from "./words.ts";

const words = loadEnglishWords();

describe("English word lists", () => {
  it("have plenty of everyday secrets of every length, all lowercase a–z", () => {
    for (let length = MIN_LENGTH; length <= MAX_LENGTH; length++) {
      const common = words.commonOfLength(length);
      expect(common.length).toBeGreaterThan(1_000);
      expect(common.every((w) => w.length === length && /^[a-z]+$/.test(w))).toBe(true);
    }
  });

  it("accept every common word as a guess, both spellings, and refuse non-words", () => {
    for (const w of words.commonOfLength(5).slice(0, 500)) expect(words.isValid(w)).toBe(true);
    expect(words.isCommon("apple")).toBe(true);
    expect(words.isCommon("colour") && words.isCommon("color")).toBe(true);
    expect(words.isValid("papal")).toBe(true);
    expect(words.isValid("qzxyw")).toBe(false);
    expect(words.isCommon("London".toLowerCase()) && words.isCommon("London")).toBe(false);
  });
});
