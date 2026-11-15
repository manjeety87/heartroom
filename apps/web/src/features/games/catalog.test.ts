import { bingo } from "@heartroom/bingo";
import { createWordGuess } from "@heartroom/word-guess";
import { describe, expect, it } from "vitest";
import { GAME_IDS, GAME_LIST, gameInfo, GAMES, isGameId, playersLabel } from "./catalog.ts";

describe("game catalog", () => {
  it("names exactly the games the server runs, by the modules' own ids", () => {
    const wordGuess = createWordGuess({
      isCommon: () => true,
      isValid: () => true,
      commonOfLength: () => [],
    });
    expect([...GAME_IDS].sort()).toEqual([bingo.id, wordGuess.id].sort());
    for (const id of GAME_IDS) expect(GAMES[id].id).toBe(id);
  });

  it("gives every game a pitch, a sensible player count and how to play", () => {
    for (const game of GAME_LIST) {
      expect(game.pitch.length).toBeGreaterThan(10);
      expect(game.minPlayers).toBeGreaterThanOrEqual(2);
      expect(game.maxPlayers).toBeGreaterThanOrEqual(game.minPlayers);
      expect(game.howToPlay.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("looks games up safely", () => {
    expect(isGameId("bingo")).toBe(true);
    expect(isGameId("chess")).toBe(false);
    expect(isGameId(null)).toBe(false);
    expect(gameInfo("constructor")).toBeNull();
    expect(playersLabel(GAMES.bingo)).toBe("2–6 players");
    expect(playersLabel(GAMES["word-guess"])).toBe("2 players");
  });
});
