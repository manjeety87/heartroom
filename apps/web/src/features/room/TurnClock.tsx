"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { TurnClock as Clock } from "@/lib/room-client/state";

/** From here the clock turns red: time to hurry, said in colour and in words. */
const HURRY_MS = 5_000;

/** Seconds as "0:12". */
const formatLeft = (ms: number) => {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * Whose clock is running and how long is left, over the board. The number updates four times a
 * second; the bar shrinks with one CSS animation per clock (transform only), restarted by `key`.
 * Screen readers get the sentence once per clock, not every second.
 */
export function TurnClock({
  clock,
  names,
  me,
}: {
  readonly clock: Clock;
  /** Name per game seat. */
  readonly names: readonly string[];
  /** The viewer's game seat, if they play. */
  readonly me: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (clock.endsAt === null) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [clock.endsAt]);

  if (clock.endsAt === null) return null; // Paused: nobody is being timed.
  const left = clock.endsAt - now;
  const isMine = clock.seat === me;
  const name = names[clock.seat] ?? "Someone";
  const who =
    clock.key === "setup"
      ? "Grids lock in"
      : clock.key.startsWith("nudge")
        ? isMine
          ? "You were nudged: call in"
          : `${name} was nudged: calls in`
        : isMine
          ? "Your call:"
          : `${name}’s call:`;
  const isHurry = left <= HURRY_MS;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-baseline justify-between gap-3 text-small">
        <span aria-live="polite" className="text-pencil">
          {who}
        </span>
        <span
          className={`font-display text-title font-bold tabular-nums ${isHurry ? "text-margin" : "text-ink"}`}
          aria-label={isHurry ? `${formatLeft(left)} left, hurry` : `${formatLeft(left)} left`}
        >
          {formatLeft(left)}
        </span>
      </p>
      <div aria-hidden className="h-1 overflow-hidden rounded-full bg-well">
        <ClockBar
          key={`${clock.key}:${String(clock.endsAt)}`}
          endsAt={clock.endsAt}
          totalMs={clock.totalMs}
          isHurry={isHurry}
        />
      </div>
    </div>
  );
}

/**
 * The bar is one CSS animation from the time left when this clock appeared to zero, so it moves on
 * the compositor and never re-renders; a new clock (new `key`) starts a new bar.
 */
function ClockBar({
  endsAt,
  totalMs,
  isHurry,
}: {
  readonly endsAt: number;
  readonly totalMs: number;
  readonly isHurry: boolean;
}) {
  const [start] = useState(() => {
    const left = Math.max(0, endsAt - Date.now());
    return { left, from: Math.min(1, left / totalMs) };
  });
  return (
    <div
      className={`h-full origin-left animate-turn-clock rounded-full transition-colors duration-(--duration-press) motion-reduce:hidden ${isHurry ? "bg-margin" : "bg-pen"}`}
      style={
        {
          "--from": String(start.from),
          animationDuration: `${String(start.left)}ms`,
        } as CSSProperties
      }
    />
  );
}
