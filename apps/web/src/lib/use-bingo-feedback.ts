"use client";

import { useEffect, useRef } from "react";
import type { BingoSeatView } from "@heartroom/bingo";
import { giveFeedback, type FeedbackEvent } from "@/lib/feedback";
import type { Profile } from "@/lib/profile";

/** What changed for the viewer between two views, as at most one feedback event (the biggest). */
export function feedbackFor(
  before: BingoSeatView | null,
  after: BingoSeatView,
): FeedbackEvent | null {
  if (before === null) return null;
  if (after.phase === "done" && before.phase !== "done") {
    return after.winners.includes(after.you) ? "win" : null;
  }
  if (after.yourLines.length > before.yourLines.length) return "line";
  const isMyTurn = (v: BingoSeatView) => v.phase === "playing" && v.turn === v.you;
  if (isMyTurn(after) && !isMyTurn(before)) return "turn";
  return null;
}

/** Plays the sound/haptic for each change in the viewer's game, as their settings allow. */
export function useBingoFeedback(view: BingoSeatView | null, profile: Profile): void {
  const previous = useRef<BingoSeatView | null>(null);
  useEffect(() => {
    if (view === null) {
      previous.current = null;
      return;
    }
    const event = feedbackFor(previous.current, view);
    previous.current = view;
    if (event !== null) giveFeedback(event, profile);
  }, [view, profile]);
}
