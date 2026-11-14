"use client";

import { SegmentedControl } from "@heartroom/ui";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import {
  filtersHref,
  type Band,
  type LeaderboardFilters,
  type Period,
} from "@/lib/leaderboard/filters";

const GAME_OPTIONS = [
  { value: "bingo", label: "Bingo" },
  { value: "word-guess", label: "Word Guess" },
] as const;
const PERIOD_OPTIONS: readonly { value: Period; label: string }[] = [
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
  { value: "all", label: "All time" },
];
const BAND_OPTIONS: readonly { value: Band; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "2", label: "2" },
  { value: "3-4", label: "3–4" },
  { value: "5-6", label: "5–6" },
];

/**
 * The board's filters live in the URL, so a board can be shared and Back works. The page renders
 * on the server; while the next one loads the old board fades instead of jumping to a skeleton.
 */
export function FilterBar({
  filters,
  children,
}: {
  readonly filters: LeaderboardFilters;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const go = (next: LeaderboardFilters) => {
    startTransition(() => {
      router.push(filtersHref(next), { scroll: false });
    });
  };
  return (
    <>
      <div className="flex flex-col gap-3">
        <SegmentedControl
          label="Game"
          options={GAME_OPTIONS}
          value={filters.game}
          onChange={(game) => {
            go({ ...filters, game, players: "any" });
          }}
        />
        <SegmentedControl
          label="Time"
          options={PERIOD_OPTIONS}
          value={filters.period}
          onChange={(period) => {
            go({ ...filters, period });
          }}
        />
        {filters.game === "bingo" && (
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-small text-pencil">Players</span>
            <div className="min-w-0 flex-1">
              <SegmentedControl
                label="Players in the game"
                options={BAND_OPTIONS}
                value={filters.players}
                onChange={(players) => {
                  go({ ...filters, players });
                }}
              />
            </div>
          </div>
        )}
      </div>
      <div
        aria-busy={isPending}
        className={`transition-opacity duration-(--duration-press) ease-out ${isPending ? "opacity-60" : ""}`}
      >
        {children}
      </div>
    </>
  );
}
