"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createRng, newSeed } from "@heartroom/engine";
import {
  BOT_LEVELS,
  lineCountFor,
  MAX_SIZE,
  MIN_SIZE,
  PRESETS,
  type BotLevel,
} from "@heartroom/bingo";
import { BingoGame, type Player } from "@heartroom/bingo/ui";
import { Button, SegmentedControl, seatColorVar } from "@heartroom/ui";
import { computerColor, useProfile } from "@/lib/profile";
import { saveFinishedGame } from "../history/history.ts";
import {
  humanView,
  isBotTurn,
  playBot,
  playHuman,
  startLocalMatch,
  type LocalMatch,
} from "./local-match.ts";
import { useBingoFeedback } from "./use-bingo-feedback.ts";

/** A short pause before the computer calls, so its move reads as a turn rather than a flicker. */
const BOT_DELAY_MS = 800;

const LEVEL_LABELS: Readonly<Record<BotLevel, string>> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};
const LEVELS = BOT_LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));

/** Copy for the reasons a move can be refused; the screen never shows raw reason keys. */
const REFUSALS: Readonly<Record<string, string>> = {
  grid_incomplete: "Fill every cell first.",
  already_called: "That number has already been called.",
  not_your_turn: "Wait for your turn.",
};

type Settings = { readonly size: number; readonly linesToWin: number; readonly level: BotLevel };

export function VsComputer() {
  const profile = useProfile();
  const [settings, setSettings] = useState<Settings>({ size: 5, linesToWin: 5, level: "medium" });
  const [match, setMatch] = useState<LocalMatch | null>(null);
  const [gameNumber, setGameNumber] = useState(1);
  const [matchId, setMatchId] = useState("");
  const rng = useRef(createRng(newSeed()));

  const players: readonly Player[] = useMemo(
    () => [
      { name: profile.name ?? "You", color: seatColorVar(profile.color) },
      { name: "Computer", color: seatColorVar(computerColor(profile.color)) },
    ],
    [profile.name, profile.color],
  );
  const view = useMemo(() => (match === null ? null : humanView(match)), [match]);
  useBingoFeedback(view, profile);

  const start = (number: number) => {
    const config = {
      size: settings.size,
      linesToWin: settings.linesToWin,
      timer: "chill",
    } as const;
    setGameNumber(number);
    setMatchId(crypto.randomUUID());
    setMatch(startLocalMatch(config, settings.level, number, rng.current));
  };

  // The computer's turn, after a short pause.
  useEffect(() => {
    if (match === null || !isBotTurn(match)) return;
    const timer = window.setTimeout(() => {
      setMatch((m) => (m === null ? m : playBot(m, rng.current)));
    }, BOT_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [match]);

  // A finished game goes to History once (saveFinishedGame ignores a repeat id).
  useEffect(() => {
    if (match?.state.phase !== "done") return;
    saveFinishedGame(match, [...players], matchId, new Date());
  }, [match, matchId, players]);

  if (match === null || view === null) {
    return (
      <SettingsForm
        settings={settings}
        onChange={setSettings}
        onStart={() => {
          start(gameNumber);
        }}
      />
    );
  }

  const refusal =
    match.rejected === null ? undefined : (REFUSALS[match.rejected] ?? "That move isn’t allowed.");
  const status = isBotTurn(match) ? "Computer is thinking…" : refusal;

  return (
    <div className="flex flex-col gap-4">
      <BingoGame
        view={view}
        players={players}
        onIntent={(action) => {
          setMatch((m) => (m === null ? m : playHuman(m, action)));
        }}
        {...(status === undefined ? {} : { status })}
        onRematch={() => {
          start(gameNumber + 1);
        }}
      />
      <Button
        variant="quiet"
        className="self-center"
        onClick={() => {
          setMatch(null);
        }}
      >
        Change settings
      </Button>
    </div>
  );
}

function SettingsForm({
  settings,
  onChange,
  onStart,
}: {
  readonly settings: Settings;
  readonly onChange: (settings: Settings) => void;
  readonly onStart: () => void;
}) {
  const sizes = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i);
  const lineOptions = Array.from({ length: lineCountFor(settings.size) }, (_, i) => i + 1);
  const selectClass =
    "min-h-11 rounded-tile bg-well px-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-pen";

  return (
    // Not a <form>: a tap before hydration would submit it natively and reload the page.
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-display text-title font-bold tracking-tight text-ink">
          Grid
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PRESETS).map(([id, preset]) => {
            const isChecked =
              settings.size === preset.size && settings.linesToWin === preset.linesToWin;
            return (
              <label
                key={id}
                className={`flex cursor-pointer flex-col gap-1 rounded-card p-3 ring-2 transition-[box-shadow,background-color] duration-(--duration-press) ease-out has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-pen ${
                  isChecked ? "bg-sheet ring-pen shadow-float" : "bg-well ring-transparent"
                }`}
              >
                <input
                  type="radio"
                  name="preset"
                  checked={isChecked}
                  onChange={() => {
                    onChange({ ...settings, size: preset.size, linesToWin: preset.linesToWin });
                  }}
                  className="sr-only"
                />
                <MiniGrid size={preset.size} />
                <span className="text-body font-semibold text-ink">{preset.label}</span>
                <span className="text-caption text-pencil">{preset.linesToWin} lines to win</span>
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 text-small text-pencil">
          <label className="flex items-center gap-2">
            Size
            <select
              className={selectClass}
              value={settings.size}
              onChange={(event) => {
                const size = Number(event.target.value);
                onChange({
                  ...settings,
                  size,
                  linesToWin: Math.min(settings.linesToWin, lineCountFor(size)),
                });
              }}
            >
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s} × {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Lines to win
            <select
              className={selectClass}
              value={settings.linesToWin}
              onChange={(event) => {
                onChange({ ...settings, linesToWin: Number(event.target.value) });
              }}
            >
              {lineOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-title font-bold tracking-tight text-ink">Computer</h2>
        <SegmentedControl
          label="How well the computer plays"
          options={LEVELS}
          value={settings.level}
          onChange={(level) => {
            onChange({ ...settings, level });
          }}
        />
      </div>
      <Button className="self-stretch sm:self-start" onClick={onStart}>
        Start game
      </Button>
      <p className="text-small text-pencil">
        Games against the computer stay on this device and don’t count towards stats.
      </p>
    </div>
  );
}

/** A tiny picture of the grid size, so presets read at a glance. */
function MiniGrid({ size }: { readonly size: number }) {
  return (
    <span
      aria-hidden
      className="grid size-10 gap-px"
      style={{ gridTemplateColumns: `repeat(${String(size)}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: size * size }, (_, i) => (
        <span key={i} className="rounded-xs bg-pencil/40" />
      ))}
    </span>
  );
}
