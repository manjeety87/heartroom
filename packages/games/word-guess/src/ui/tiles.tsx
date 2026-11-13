import { useEffect } from "react";
import type { Mark } from "../feedback.ts";

const MARK_WORDS: Readonly<Record<Mark, string>> = {
  correct: "right place",
  present: "in word, wrong place",
  absent: "not in word",
};

/**
 * One letter. Never colour alone (design-direction › Accessibility): right place = pen fill and a
 * tick notch; in the word = highlighter with an ink ring; not in the word = well fill, struck through.
 */
export function WordTile({
  letter,
  mark,
  size = "large",
}: {
  readonly letter: string;
  readonly mark?: Mark | undefined;
  readonly size?: "large" | "small";
}) {
  const box = size === "large" ? "size-12 text-title sm:size-14" : "size-7 text-caption";
  const look =
    mark === "correct"
      ? "bg-pen text-on-pen"
      : mark === "present"
        ? "bg-highlighter text-on-highlighter ring-2 ring-ink ring-inset"
        : mark === "absent"
          ? "bg-well text-pencil line-through"
          : letter === ""
            ? "border-2 border-line"
            : "border-2 border-pencil text-ink";
  const label =
    letter === ""
      ? mark === undefined
        ? "empty"
        : MARK_WORDS[mark]
      : `${letter.toUpperCase()}${mark ? `, ${MARK_WORDS[mark]}` : ""}`;
  return (
    <span
      role="img"
      aria-label={label}
      className={`relative grid place-items-center rounded-tile font-display font-extrabold uppercase ${box} ${look}`}
    >
      {letter}
      {mark === "correct" && (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 size-0 border-t-[6px] border-l-[6px] border-t-on-pen border-l-transparent"
        />
      )}
    </span>
  );
}

/** A row of tiles: a guess with its marks, the word being typed, or an empty row. */
export function WordRow({
  length,
  word = "",
  marks,
  size = "large",
  label,
}: {
  readonly length: number;
  readonly word?: string;
  readonly marks?: readonly Mark[] | undefined;
  readonly size?: "large" | "small";
  readonly label?: string | undefined;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex ${size === "large" ? "gap-1.5" : "gap-1"}`}
    >
      {Array.from({ length }, (_, i) => (
        <WordTile key={i} letter={word[i] ?? ""} mark={marks?.[i]} size={size} />
      ))}
    </div>
  );
}

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"] as const;
const RANK: Readonly<Record<Mark, number>> = { absent: 0, present: 1, correct: 2 };

/** The best thing each letter has been shown to be across these guesses. */
export function letterMarks(
  rows: readonly { readonly word: string; readonly marks: readonly Mark[] }[],
): Map<string, Mark> {
  const best = new Map<string, Mark>();
  for (const row of rows) {
    [...row.marks].forEach((mark, i) => {
      const letter = row.word.charAt(i);
      const known = best.get(letter);
      if (known === undefined || RANK[mark] > RANK[known]) best.set(letter, mark);
    });
  }
  return best;
}

/**
 * Our own keyboard (phones) plus the physical one: letters, Enter, Backspace. Keys show what each
 * letter is known to be with the same colour + shape as the tiles. Key presses aren't animated.
 */
export function GameKeyboard({
  marks,
  disabled,
  onLetter,
  onEnter,
  onBackspace,
}: {
  readonly marks: ReadonlyMap<string, Mark>;
  readonly disabled: boolean;
  readonly onLetter: (letter: string) => void;
  readonly onEnter: () => void;
  readonly onBackspace: () => void;
}) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "Enter") onEnter();
      else if (event.key === "Backspace") onBackspace();
      else if (/^[a-z]$/i.test(event.key)) onLetter(event.key.toLowerCase());
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [disabled, onLetter, onEnter, onBackspace]);

  const key =
    "grid h-12 min-w-0 flex-1 place-items-center rounded-tile text-body font-semibold uppercase touch-manipulation select-none focus-visible:outline-2 focus-visible:outline-pen disabled:opacity-50";
  return (
    <div aria-label="Keyboard" role="group" className="flex flex-col gap-1.5">
      {ROWS.map((row, r) => (
        <div key={row} className="flex gap-1">
          {r === 2 && (
            <button
              type="button"
              disabled={disabled}
              onClick={onEnter}
              className={`${key} flex-[1.5] bg-pen text-small text-on-pen`}
            >
              Enter
            </button>
          )}
          {Array.from(row).map((letter) => {
            const mark = marks.get(letter);
            const look =
              mark === "correct"
                ? "bg-pen text-on-pen"
                : mark === "present"
                  ? "bg-highlighter text-on-highlighter ring-2 ring-ink ring-inset"
                  : mark === "absent"
                    ? "bg-paper text-pencil line-through"
                    : "bg-well text-ink";
            return (
              <button
                key={letter}
                type="button"
                disabled={disabled}
                aria-label={
                  mark ? `${letter.toUpperCase()}, ${MARK_WORDS[mark]}` : letter.toUpperCase()
                }
                onClick={() => {
                  onLetter(letter);
                }}
                className={`${key} ${look}`}
              >
                {letter}
              </button>
            );
          })}
          {r === 2 && (
            <button
              type="button"
              disabled={disabled}
              onClick={onBackspace}
              aria-label="Delete letter"
              className={`${key} flex-[1.5] bg-well text-ink`}
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
