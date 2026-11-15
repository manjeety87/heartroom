import { bingoViewSchema, type BingoView } from "@heartroom/bingo";
import { wordGuessViewSchema, type WordGuessView } from "@heartroom/word-guess";
import type { ZodType } from "zod";
import { isGameId, type GameId } from "./catalog.ts";

/**
 * A view from the server, checked against its game's own `viewSchema` before anything draws it.
 * The result says which game it is, so screens switch on it instead of casting.
 */
export type GameView =
  | { readonly gameId: "bingo"; readonly view: BingoView }
  | { readonly gameId: "word-guess"; readonly view: WordGuessView };

const SCHEMAS: { readonly [Id in GameId]: ZodType<Extract<GameView, { gameId: Id }>["view"]> } = {
  bingo: bingoViewSchema,
  "word-guess": wordGuessViewSchema,
};

/** Null when the game is unknown to this site or the view isn't what that game sends. */
export function parseView(gameId: string, view: unknown): GameView | null {
  if (!isGameId(gameId)) return null;
  switch (gameId) {
    case "bingo": {
      const parsed = SCHEMAS.bingo.safeParse(view);
      return parsed.success ? { gameId, view: parsed.data } : null;
    }
    case "word-guess": {
      const parsed = SCHEMAS["word-guess"].safeParse(view);
      return parsed.success ? { gameId, view: parsed.data } : null;
    }
  }
}
