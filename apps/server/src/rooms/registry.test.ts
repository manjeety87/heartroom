import { describe, expect, it } from "vitest";
import { GAMES, isGameId } from "./registry.ts";

describe("registry", () => {
  it("knows each game by the id the module declares", () => {
    for (const [id, game] of Object.entries(GAMES)) expect(game.id).toBe(id);
  });

  it("when asked about an unknown or inherited name, then says no", () => {
    expect(isGameId("bingo")).toBe(true);
    expect(isGameId("chess")).toBe(false);
    expect(isGameId("toString")).toBe(false);
  });
});
