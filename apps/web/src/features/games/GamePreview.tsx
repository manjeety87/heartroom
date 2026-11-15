import type { ReactNode } from "react";
import type { GameId } from "./catalog.ts";

/**
 * A small picture of each game, drawn with the game's own pieces (a Bingo grid with circled calls,
 * a row of Word Guess tiles). Decorative: the card's text says everything, so it is aria-hidden.
 */

/** Numbers already called on the preview card, circled the way you circle them on paper. */
const CALLED = new Set([7, 12, 3, 19, 25, 14]);
const BINGO_GRID = [
  7, 21, 3, 16, 10, 12, 1, 19, 24, 5, 18, 14, 9, 2, 25, 4, 23, 11, 20, 8, 15, 6, 22, 13, 17,
];

function BingoPreview() {
  return (
    <div className="grid w-32 grid-cols-5 gap-0.5 sm:w-36">
      {BINGO_GRID.map((n) => (
        <span
          key={n}
          className="flex aspect-square items-center justify-center rounded-[4px] bg-paper font-display text-caption font-bold text-ink tabular-nums"
        >
          <span
            className={`flex size-[85%] items-center justify-center rounded-full ${
              CALLED.has(n) ? "ring-2 ring-(--color-game-bingo)" : ""
            }`}
          >
            {n}
          </span>
        </span>
      ))}
    </div>
  );
}

/** HEART: letters in the right place filled, letters elsewhere ringed, others plain. */
const WORD: readonly { letter: string; mark: "right" | "elsewhere" | "none" }[] = [
  { letter: "H", mark: "right" },
  { letter: "E", mark: "none" },
  { letter: "A", mark: "elsewhere" },
  { letter: "R", mark: "right" },
  { letter: "T", mark: "none" },
];

function WordGuessPreview() {
  return (
    <div className="flex gap-1">
      {WORD.map(({ letter, mark }) => (
        <span
          key={letter}
          className={`flex size-7 items-center justify-center rounded-[6px] font-display text-small font-extrabold sm:size-8 ${
            mark === "right"
              ? "bg-highlighter text-on-highlighter"
              : mark === "elsewhere"
                ? "bg-paper text-ink ring-2 ring-highlighter ring-inset"
                : "bg-well text-pencil"
          }`}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}

export const GAME_PREVIEWS: Readonly<Record<GameId, () => ReactNode>> = {
  bingo: BingoPreview,
  "word-guess": WordGuessPreview,
};
