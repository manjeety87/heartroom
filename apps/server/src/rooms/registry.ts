import { bingo } from "@heartroom/bingo";
import type { GameModule, Json } from "@heartroom/engine";
import { createWordGuess } from "@heartroom/word-guess";
import { loadEnglishWords } from "@heartroom/word-guess/server";

/**
 * Every game the server can run. Adding a game is one line here and nothing else in the platform
 * (AGENTS.md).
 */
export const GAMES = { bingo, "word-guess": createWordGuess(loadEnglishWords()) } as const;

export type GameId = keyof typeof GAMES;

/**
 * A game with its own types erased, for platform code that handles any game the same way (the room
 * only passes config, state and actions between the module's own functions).
 */
export type AnyGame = GameModule<unknown, unknown, unknown, Json>;

export const gameById = (id: GameId): AnyGame => GAMES[id];

export function isGameId(id: string): id is GameId {
  return Object.hasOwn(GAMES, id);
}
