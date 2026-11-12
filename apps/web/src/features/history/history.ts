"use client";

import { z } from "zod";
import { replay, SEED_BYTES } from "@heartroom/engine";
import {
  bingo,
  bingoActionSchema,
  bingoConfigSchema,
  BOT_LEVELS,
  type BingoState,
} from "@heartroom/bingo";
import { useStored, writeStored, readStored } from "@/lib/stored";
import type { LocalMatch } from "../vs-computer/local-match.ts";

/**
 * Finished games on this device. Each record is the match's seed plus every move, the same
 * `(config, seed, actions)` the server will store, so History rebuilds any moment of a game with
 * the engine's `replay()` instead of trusting a saved picture. The newest 50 are kept.
 */

const KEY = "heartroom.history.v1";
const MAX_GAMES = 50;

const playerSchema = z.object({ name: z.string().min(1).max(40), color: z.string().max(60) });

const gameSchema = z.object({
  id: z.string().min(1).max(64),
  playedAt: z.iso.datetime(),
  kind: z.literal("vs-computer"),
  level: z.enum(BOT_LEVELS),
  config: bingoConfigSchema,
  seed: z.base64().refine((s) => decode(s).length === SEED_BYTES),
  actions: z
    .array(
      z.object({
        seat: z.number().int().min(0).max(5),
        action: bingoActionSchema,
        by: z.enum(["player", "server"]),
      }),
    )
    .max(500),
  players: z.array(playerSchema).min(2).max(6),
  winners: z.array(z.number().int().min(0).max(5)),
});

export type SavedGame = z.infer<typeof gameSchema>;

const historySchema = z.array(z.unknown()).transform((items) =>
  // One damaged record must not hide the rest.
  items.flatMap((item) => {
    const parsed = gameSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  }),
);

const encode = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
function decode(base64: string): Uint8Array {
  const raw = atob(base64);
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

export const useHistory = (): readonly SavedGame[] => useStored(KEY, historySchema, []);

export const readHistory = (): readonly SavedGame[] => readStored(KEY, historySchema, []);

export function saveFinishedGame(
  match: LocalMatch,
  players: SavedGame["players"],
  id: string,
  playedAt: Date,
): void {
  const games = readHistory();
  if (games.some((g) => g.id === id)) return;
  const game: SavedGame = {
    id,
    playedAt: playedAt.toISOString(),
    kind: "vs-computer",
    level: match.level,
    config: match.config,
    seed: encode(match.seed),
    actions: [...match.log],
    players,
    winners: [...match.state.winners],
  };
  writeStored(KEY, [game, ...games].slice(0, MAX_GAMES));
}

export function deleteGame(id: string): void {
  writeStored(
    KEY,
    readHistory().filter((g) => g.id !== id),
  );
}

/** The game's state after its first `moves` moves (all of them when omitted). */
export function stateAt(game: SavedGame, moves?: number): BingoState {
  return replay(bingo, {
    config: game.config,
    seed: decode(game.seed),
    seats: game.players.length,
    actions: game.actions.slice(0, moves),
  });
}

/** Index in `actions` just after the `calls`-th call (0 = when setup finished). */
export function movesThroughCall(game: SavedGame, calls: number): number {
  let seen = 0;
  for (let i = 0; i < game.actions.length; i++) {
    if (game.actions[i]?.action.type !== "call") continue;
    if (seen === calls) return i;
    seen++;
  }
  return game.actions.length;
}

export const callCount = (game: SavedGame): number =>
  game.actions.filter((a) => a.action.type === "call").length;
