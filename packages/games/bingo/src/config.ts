import { z } from "zod";

export const MIN_SIZE = 3;
export const MAX_SIZE = 8;
export const MAX_SEATS = 6;

/** Fast mode turn length, and the Chill mode clock that a Nudge starts. */
export const TURN_MS = 15_000;
export const NUDGE_MS = 30_000;

export const TIMER_MODES = ["fast", "chill", "away-only"] as const;
export type TimerMode = (typeof TIMER_MODES)[number];

/** Rows + columns + 2 diagonals. */
export const lineCountFor = (size: number): number => 2 * size + 2;

/** Bigger grids get more setup time: 30 s at 5×5, clamped to 20–90 s. */
export function setupMsFor(size: number): number {
  const seconds = Math.min(90, Math.max(20, 30 + 2 * (size * size - 25)));
  return seconds * 1000;
}

export const bingoConfigSchema = z
  .strictObject({
    size: z.number().int().min(MIN_SIZE).max(MAX_SIZE),
    linesToWin: z.number().int().min(1).max(lineCountFor(MAX_SIZE)),
    timer: z.enum(TIMER_MODES),
    /** Who calls first. The room rotates it between games, skipping empty seats. */
    firstSeat: z
      .number()
      .int()
      .min(0)
      .max(MAX_SEATS - 1),
  })
  .refine((c) => c.linesToWin <= lineCountFor(c.size), {
    message: "linesToWin is more than the grid has",
    path: ["linesToWin"],
  });

export type BingoConfig = z.infer<typeof bingoConfigSchema>;

export const CLASSIC: BingoConfig = { size: 5, linesToWin: 5, timer: "fast", firstSeat: 0 };

export const PRESETS = {
  classic: { label: "Classic 5×5", size: 5, linesToWin: 5 },
  quick: { label: "Quick 4×4", size: 4, linesToWin: 4 },
  big: { label: "Big 6×6", size: 6, linesToWin: 6 },
  crazy: { label: "Crazy 8×8", size: 8, linesToWin: 8 },
} as const;

/** Only Classic 5×5 / 5 lines counts towards rankings. */
export const isClassic = (c: Pick<BingoConfig, "size" | "linesToWin">): boolean =>
  c.size === 5 && c.linesToWin === 5;
