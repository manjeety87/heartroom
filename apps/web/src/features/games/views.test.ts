import { bingo, CLASSIC } from "@heartroom/bingo";
import { newSeed, startMatch } from "@heartroom/engine";
import { describe, expect, it } from "vitest";
import { parseView } from "./views.ts";

describe("parseView", () => {
  const state = startMatch(bingo, { config: CLASSIC, seats: 2, seed: newSeed() });
  const seatView = bingo.view(state, { kind: "seat", seat: 0 });

  it("accepts a real view and says which game it is", () => {
    expect(parseView("bingo", seatView)).toMatchObject({ gameId: "bingo", view: { kind: "seat" } });
  });

  it("refuses an unknown game, another game's view, and a view with an unknown field", () => {
    expect(parseView("chess", seatView)).toBeNull();
    expect(parseView("word-guess", seatView)).toBeNull();
    expect(parseView("bingo", { ...seatView, secret: 42 })).toBeNull();
    expect(parseView("bingo", null)).toBeNull();
  });
});
