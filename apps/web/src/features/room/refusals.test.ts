import { ERROR_MESSAGES } from "@heartroom/protocol";
import { describe, expect, it } from "vitest";
import { refusalCopy } from "./refusals.ts";

describe("refusalCopy", () => {
  it("says why a word was refused, from the game's reason", () => {
    expect(refusalCopy("word-guess", { code: "RULE_VIOLATION", reason: "not_a_word" })).toMatch(
      /isn’t a word/,
    );
    expect(
      refusalCopy("word-guess", { code: "RULE_VIOLATION", reason: "not_a_common_word" }),
    ).toMatch(/everyday word/);
  });

  it("falls back to the game's wording for the code, then the protocol's", () => {
    expect(refusalCopy("bingo", { code: "NOT_YOUR_TURN" })).toBe("Wait for your turn.");
    expect(refusalCopy("bingo", { code: "RULE_VIOLATION", reason: "no_such_seat" })).toBe(
      "That move isn’t allowed.",
    );
    expect(refusalCopy(null, { code: "RATE_LIMITED" })).toBe(ERROR_MESSAGES.RATE_LIMITED);
    expect(refusalCopy("bingo", { code: "RULE_VIOLATION", reason: "toString" })).toBe(
      "That move isn’t allowed.",
    );
  });
});
