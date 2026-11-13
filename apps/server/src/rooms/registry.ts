import { bingo } from "@heartroom/bingo";

/**
 * Every game the server can run. Adding a game is one line here and nothing else in the platform
 * (AGENTS.md). Word Guess joins in Phase 5.
 */
export const GAMES = { bingo } as const;

export type GameId = keyof typeof GAMES;

export function isGameId(id: string): id is GameId {
  return Object.hasOwn(GAMES, id);
}
