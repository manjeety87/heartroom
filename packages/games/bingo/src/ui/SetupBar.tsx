import { Button } from "@heartroom/ui";

export type SetupBarProps = {
  readonly nextNumber: number | null;
  readonly isFull: boolean;
  readonly isEmpty: boolean;
  readonly onShuffle: () => void;
  readonly onClear: () => void;
  readonly onReady: () => void;
};

/** Setup: tap cells to place 1, 2, 3… in order, or Shuffle; Ready once the grid is full. */
export function SetupBar({
  nextNumber,
  isFull,
  isEmpty,
  onShuffle,
  onClear,
  onReady,
}: SetupBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-body text-pencil" aria-live="polite">
        {isFull
          ? "Your grid is ready to go."
          : `Tap a cell to place ${String(nextNumber)}, or shuffle the rest.`}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={onShuffle}>
          Shuffle
        </Button>
        <Button variant="quiet" onClick={onClear} disabled={isEmpty}>
          Clear
        </Button>
        <Button onClick={onReady} disabled={!isFull}>
          Ready
        </Button>
      </div>
    </div>
  );
}
