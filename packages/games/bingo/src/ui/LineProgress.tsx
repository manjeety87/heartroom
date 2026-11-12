import { linesLabel } from "./a11y.ts";

const WORD = ["B", "I", "N", "G", "O"] as const;

export type LineProgressProps = {
  readonly count: number;
  readonly linesToWin: number;
  readonly isCompact?: boolean;
};

/**
 * Progress towards the target. A 5-line target spells B-I-N-G-O; any other target shows one ring
 * per line plus "3 / 6", so every custom setting reads naturally.
 */
export function LineProgress({ count, linesToWin, isCompact = false }: LineProgressProps) {
  const done = Math.min(count, linesToWin);
  const label = linesLabel(done, linesToWin);
  if (linesToWin === WORD.length) {
    return (
      <div role="img" aria-label={label} className="flex gap-1">
        {WORD.map((letter, i) => (
          <span
            key={letter}
            className={`grid place-items-center rounded-tile font-display font-extrabold ${
              isCompact ? "size-6 text-small" : "size-10 text-title"
            } ${i < done ? "bg-ink text-paper motion-safe:animate-fade-in" : "bg-well text-pencil"}`}
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
          key={i}
          className={`rounded-pill border-2 border-ink ${isCompact ? "size-3" : "size-4"} ${
            i < done ? "bg-ink" : "bg-transparent"
          }`}
        />
      ))}
      <span className="ml-1 text-small tabular-nums text-pencil">
        {done} / {linesToWin}
      </span>
    </div>
  );
}
