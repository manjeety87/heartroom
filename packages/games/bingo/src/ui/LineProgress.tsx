import { linesLabel } from "./a11y.ts";

const WORD = ["B", "I", "N", "G", "O"] as const;

export type LineProgressProps = {
  readonly count: number;
  readonly linesToWin: number;
  readonly isCompact?: boolean;
};

/**
 * Progress towards the target. A 5-line target spells B-I-N-G-O, each letter stamped in as its
 * line completes; any other target shows one ring per line plus "3 / 6".
 */
export function LineProgress({ count, linesToWin, isCompact = false }: LineProgressProps) {
  const done = Math.min(count, linesToWin);
  const label = linesLabel(done, linesToWin);
  if (linesToWin === WORD.length) {
    return (
      <div role="img" aria-label={label} className="flex gap-1">
        {WORD.map((letter, i) => (
          <span
            key={`${letter}-${String(i < done)}`}
            className={`grid place-items-center rounded-cell font-display font-extrabold ${
              isCompact ? "size-5 text-caption" : "size-11 text-h2"
            } ${i < done ? "animate-stamp bg-ink text-paper motion-reduce:animate-fade-in" : "bg-well text-pencil"}`}
          >
            {letter}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div role="img" aria-label={label} className="flex flex-wrap items-center gap-1">
      {Array.from({ length: linesToWin }, (_, i) => (
        <span
          key={`${String(i)}-${String(i < done)}`}
          className={`rounded-pill border-2 border-ink ${isCompact ? "size-2.5" : "size-4"} ${
            i < done ? "animate-stamp bg-ink motion-reduce:animate-fade-in" : "bg-transparent"
          }`}
        />
      ))}
      <span
        className={`ml-1 tabular-nums text-pencil ${isCompact ? "text-caption" : "text-small"}`}
      >
        {done} / {linesToWin}
      </span>
    </div>
  );
}
