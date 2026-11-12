import { Button } from "@heartroom/ui";
import type { BingoView } from "../view.ts";
import { joinNames } from "./a11y.ts";
import { BingoBoard } from "./BingoBoard.tsx";
import { LineProgress } from "./LineProgress.tsx";

export type ResultsRevealProps = {
  readonly view: BingoView;
  readonly names: readonly string[];
  readonly onRematch?: () => void;
  readonly rematchLabel?: string;
};

/** End of game: who won, then every grid with its lines; losers see how far they were. */
export function ResultsReveal({
  view,
  names,
  onRematch,
  rematchLabel = "Rematch",
}: ResultsRevealProps) {
  if (view.reveal === null) return null;
  const { grids, lines } = view.reveal;
  const winnerNames = view.winners.map((seat) => names[seat] ?? `Seat ${String(seat + 1)}`);
  const headline =
    view.winners.length > 1
      ? `${joinNames(winnerNames)} — BINGO together`
      : `${joinNames(winnerNames)} — BINGO`;
  // Winners first, then the rest in seat order.
  const order = [
    ...view.winners,
    ...grids.map((_, s) => s).filter((s) => !view.winners.includes(s)),
  ];

  return (
    <section aria-labelledby="bingo-result" className="flex flex-col gap-6">
      <h2 id="bingo-result" className="text-center font-display text-h2 font-extrabold text-ink">
        {headline}
      </h2>
      {onRematch && (
        <Button className="self-center" onClick={onRematch}>
          {rematchLabel}
        </Button>
      )}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {order.map((seat) => {
          const name = names[seat] ?? `Seat ${String(seat + 1)}`;
          const seatLines = lines[seat] ?? [];
          const isWinner = view.winners.includes(seat);
          const short = view.linesToWin - seatLines.length;
          return (
            <li
              key={seat}
              className={`flex flex-col gap-2 rounded-card bg-sheet p-3 ${isWinner ? "ring-2 ring-pen" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{name}</span>
                <LineProgress count={seatLines.length} linesToWin={view.linesToWin} isCompact />
              </div>
              <BingoBoard
                size={view.size}
                grid={grids[seat] ?? []}
                called={view.called}
                lines={seatLines}
                label={`${name}’s grid`}
                isCompact
              />
              {!isWinner && (
                <p className="text-small text-pencil">
                  Needed {short} more {short === 1 ? "line" : "lines"}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
