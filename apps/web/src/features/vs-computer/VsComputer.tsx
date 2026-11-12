"use client";

import { useEffect, useRef, useState } from "react";
import { createRng, newSeed } from "@heartroom/engine";
import {
  BOT_LEVELS,
  lineCountFor,
  MAX_SIZE,
  MIN_SIZE,
  PRESETS,
  type BotLevel,
} from "@heartroom/bingo";
import { BingoGame } from "@heartroom/bingo/ui";
import { Button } from "@heartroom/ui";
import {
  humanView,
  isBotTurn,
  playBot,
  playHuman,
  startLocalMatch,
  type LocalMatch,
} from "./local-match.ts";

/** A short pause before the computer calls, so its move reads as a turn rather than a flicker. */
const BOT_DELAY_MS = 800;

const NAMES = ["You", "Computer"] as const;
const LEVEL_LABELS: Readonly<Record<BotLevel, string>> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/** Copy for the reasons a move can be refused; the screen never shows raw reason keys. */
const REFUSALS: Readonly<Record<string, string>> = {
  grid_incomplete: "Fill every cell first.",
  already_called: "That number has already been called.",
  not_your_turn: "Wait for your turn.",
};

type Settings = { readonly size: number; readonly linesToWin: number; readonly level: BotLevel };

export function VsComputer() {
  const [settings, setSettings] = useState<Settings>({ size: 5, linesToWin: 5, level: "medium" });
  const [match, setMatch] = useState<LocalMatch | null>(null);
  const [gameNumber, setGameNumber] = useState(1);
  const rng = useRef(createRng(newSeed()));

  const start = (number: number) => {
    setGameNumber(number);
    const config = {
      size: settings.size,
      linesToWin: settings.linesToWin,
      timer: "chill",
    } as const;
    setMatch(startLocalMatch(config, settings.level, number, rng.current));
  };

  useEffect(() => {
    if (match === null || !isBotTurn(match)) return;
    const timer = window.setTimeout(() => {
      setMatch((m) => (m === null ? m : playBot(m, rng.current)));
    }, BOT_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [match]);

  if (match === null) {
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
        view={humanView(match)}
        names={NAMES}
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

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        onStart();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold text-ink">Grid</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRESETS).map(([id, preset]) => (
            <Choice
              key={id}
              name="preset"
              label={preset.label}
              isChecked={settings.size === preset.size && settings.linesToWin === preset.linesToWin}
              onSelect={() => {
                onChange({ ...settings, size: preset.size, linesToWin: preset.linesToWin });
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-small text-pencil">
          <label className="flex items-center gap-2">
            Size
            <select
              className="min-h-11 rounded-tile bg-well px-3 text-body text-ink"
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
              className="min-h-11 rounded-tile bg-well px-3 text-body text-ink"
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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold text-ink">Computer</legend>
        <div className="flex flex-wrap gap-2">
          {BOT_LEVELS.map((level) => (
            <Choice
              key={level}
              name="level"
              label={LEVEL_LABELS[level]}
              isChecked={settings.level === level}
              onSelect={() => {
                onChange({ ...settings, level });
              }}
            />
          ))}
        </div>
      </fieldset>
      <Button type="submit" className="self-start">
        Start game
      </Button>
      <p className="text-small text-pencil">
        Games against the computer stay on this device and don’t count towards stats.
      </p>
    </form>
  );
}

/** A radio styled as a pill. The real input keeps keyboard and screen-reader behaviour. */
function Choice({
  name,
  label,
  isChecked,
  onSelect,
}: {
  readonly name: string;
  readonly label: string;
  readonly isChecked: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center rounded-pill px-4 text-body has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-pen ${
        isChecked ? "bg-pen text-on-pen" : "bg-well text-ink"
      }`}
    >
      <input type="radio" name={name} checked={isChecked} onChange={onSelect} className="sr-only" />
      {label}
    </label>
  );
}
