import { Button } from "@heartroom/ui";
import type { BingoView } from "../view.ts";
import { joinNames } from "./a11y.ts";
import { BingoBoard } from "./BingoBoard.tsx";
import { LineProgress } from "./LineProgress.tsx";
import { CallLog, marksFor, playerAt, PlayerDot, type Player } from "./players.tsx";

export type ResultsRevealProps = {
  readonly view: BingoView;
  readonly players: readonly Player[];
  /** The viewer's seat, or null for a spectator or a replay from history. */
  readonly you: number | null;
  readonly onRematch?: () => void;
  readonly rematchLabel?: string;
};

/** Each revealed grid arrives this long after the previous one (design-direction: 60 ms). */
const STAGGER_MS = 60;

/**
 * End of game: who won, then every grid with its lines and who called each number. The winner's
 * grid lifts once; the others rise in one after another. No confetti.
 */
export function ResultsReveal({
  view,
  players,
  you,
  onRematch,
  rematchLabel = "Rematch",
}: ResultsRevealProps) {
  if (view.reveal === null) return null;
  const { grids, lines } = view.reveal;
  const nameOf = (seat: number) => (seat === you ? "You" : playerAt(players, seat).name);
  const winnerNames = view.winners.map(nameOf);
  const headline =
    view.winners.length > 1
      ? `${joinNames(winnerNames)} — BINGO together`
      : winnerNames[0] === "You"
        ? "You win — BINGO!"
        : `${winnerNames[0] ?? ""} wins — BINGO`;
  const order = [
    ...view.winners,
    ...grids.map((_, s) => s).filter((s) => !view.winners.includes(s)),
  ];
  const marks = marksFor(view, players, you);

  return (
    <section aria-labelledby="bingo-result" className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2
          id="bingo-result"
          className="animate-stamp font-display text-h1 font-extrabold tracking-tight text-ink motion-reduce:animate-fade-in"
        >
          {headline}
        </h2>
        <p className="text-small text-pencil">
          {view.called.length} numbers called · first to {view.linesToWin}{" "}
          {view.linesToWin === 1 ? "line" : "lines"}
        </p>
        {onRematch && <Button onClick={onRematch}>{rematchLabel}</Button>}
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {order.map((seat, i) => {
          const player = playerAt(players, seat);
          const seatLines = lines[seat] ?? [];
          const isWinner = view.winners.includes(seat);
          const short = view.linesToWin - seatLines.length;
          return (
            <li
              key={seat}
              className="animate-rise motion-reduce:animate-fade-in"
              style={{ animationDelay: `${String(i * STAGGER_MS)}ms` }}
            >
              <div
                className={`flex flex-col gap-2 rounded-card bg-sheet p-3 ${isWinner ? "animate-lift shadow-float ring-2 motion-reduce:animate-none" : ""}`}
                style={
                  isWinner
                    ? { ["--tw-ring-color" as string]: player.color, animationDelay: "320ms" }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    <PlayerDot color={player.color} isLarge />
                    {nameOf(seat)}
                  </span>
                  <LineProgress count={seatLines.length} linesToWin={view.linesToWin} isCompact />
                </div>
                <BingoBoard
                  size={view.size}
                  grid={grids[seat] ?? []}
                  marks={marks}
                  lines={seatLines}
                  label={`${nameOf(seat)}’s grid`}
                  isCompact
                />
                <p className="text-small text-pencil">
                  {isWinner
                    ? "Winner"
                    : `Needed ${String(short)} more ${short === 1 ? "line" : "lines"}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <CallLog view={view} players={players} you={you} />
    </section>
  );
}
