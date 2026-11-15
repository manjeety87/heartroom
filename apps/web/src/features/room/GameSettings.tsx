"use client";

import { useState } from "react";
import {
  bingoConfigSchema,
  CLASSIC,
  lineCountFor,
  PRESETS,
  TIMER_MODES,
  type BingoConfig,
  type TimerMode,
} from "@heartroom/bingo";
import type { RoomMessage } from "@heartroom/protocol";
import { SegmentedControl } from "@heartroom/ui";
import {
  CLASSIC_WORD_GUESS,
  MAX_GUESSES,
  MAX_LENGTH,
  MIN_LENGTH,
  wordGuessConfigSchema,
  type WordGuessConfig,
} from "@heartroom/word-guess";
import { sendHost } from "@/lib/room-client/client";
import { CUSTOM_SIZES, withGrid } from "./bingo-custom.ts";
import { GAME_LIST, isGameId, playersLabel, type GameId } from "@/features/games/catalog";

/**
 * The games a room can play and each one's settings, as the lobby shows them. The server checks
 * every config with the game's own schema; this only offers valid ones.
 */

type PresetId = keyof typeof PRESETS;
const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

const TIMERS: Readonly<Record<TimerMode, { label: string; hint: string }>> = {
  fast: { label: "Fast", hint: "15 seconds for each call." },
  chill: { label: "Chill", hint: "No clock. Nudge a slow caller to give them 30 seconds." },
  "away-only": { label: "Away only", hint: "The clock runs only when a player drops off." },
};
const TIMER_OPTIONS = TIMER_MODES.map((value) => ({ value, label: TIMERS[value].label }));

const presetOf = (config: BingoConfig): PresetId | null =>
  PRESET_IDS.find(
    (id) => PRESETS[id].size === config.size && PRESETS[id].linesToWin === config.linesToWin,
  ) ?? null;

/** Each game's settings in words: "Classic 5×5 · Fast", "5 letters, 5 guesses". Null if invalid. */
const DESCRIBE: Readonly<Record<GameId, (config: unknown) => string | null>> = {
  bingo: (raw) => {
    const parsed = bingoConfigSchema.safeParse(raw);
    if (!parsed.success) return null;
    const config = parsed.data;
    const preset = presetOf(config);
    const grid =
      preset === null
        ? `${String(config.size)}×${String(config.size)}, ${String(config.linesToWin)} lines`
        : PRESETS[preset].label;
    return `${grid} · ${TIMERS[config.timer].label}`;
  },
  "word-guess": (raw) => {
    const parsed = wordGuessConfigSchema.safeParse(raw);
    if (!parsed.success) return null;
    return `${String(parsed.data.length)} letters, ${String(parsed.data.maxGuesses)} guesses`;
  },
};

/** The room's chosen settings, in words, without the game's name. */
export function describeSettings(room: RoomMessage): string | null {
  return isGameId(room.gameId) ? DESCRIBE[room.gameId](room.gameConfig) : null;
}

/** Picking a game starts from its classic settings. */
const CHOOSE: Readonly<Record<GameId, () => void>> = {
  bingo: () => {
    sendBingo(CLASSIC);
  },
  "word-guess": () => {
    sendWordGuess(CLASSIC_WORD_GUESS);
  },
};

export function chooseGame(id: GameId): void {
  CHOOSE[id]();
}

function sendBingo(config: BingoConfig) {
  // The room rotates who calls first between games, so firstSeat always starts at 0.
  sendHost({ type: "host", kind: "config", gameId: "bingo", config: { ...config, firstSeat: 0 } });
}

function sendWordGuess(config: WordGuessConfig) {
  sendHost({ type: "host", kind: "config", gameId: "word-guess", config });
}

/** Radio cards: a big label and a small line under it. */
function Choice({
  label,
  hint,
  isChecked,
  disabled = false,
  onChoose,
}: {
  readonly label: string;
  readonly hint: string;
  readonly isChecked: boolean;
  readonly disabled?: boolean;
  readonly onChoose: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isChecked}
      disabled={disabled}
      onClick={onChoose}
      className={`flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-card px-3 py-2 text-left ring-2 transition-[box-shadow,background-color,transform] duration-(--duration-press) ease-out active:scale-97 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen motion-reduce:active:scale-100 ${
        isChecked ? "bg-sheet shadow-float ring-pen" : "bg-well ring-transparent"
      }`}
    >
      <span className="text-body font-semibold text-ink">{label}</span>
      <span className="text-caption text-pencil">{hint}</span>
    </button>
  );
}

export function GamePicker({
  room,
  onPicked,
}: {
  readonly room: RoomMessage;
  readonly onPicked: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Game">
      {GAME_LIST.map((game) => (
        <Choice
          key={game.id}
          label={game.name}
          hint={playersLabel(game)}
          isChecked={room.gameId === game.id}
          onChoose={() => {
            if (room.gameId !== game.id) chooseGame(game.id);
            onPicked();
          }}
        />
      ))}
    </div>
  );
}

const SIZE_OPTIONS = CUSTOM_SIZES.map((size) => ({
  value: String(size),
  label: `${String(size)}×${String(size)}`,
}));

export function BingoSettings({ room }: { readonly room: RoomMessage }) {
  const parsed = bingoConfigSchema.safeParse(room.gameConfig);
  const config = parsed.success ? parsed.data : null;
  const chosen = config === null ? null : presetOf(config);
  // Custom stays open while the host tweaks it, even when it happens to match a preset.
  const [wantsCustom, setWantsCustom] = useState(false);
  const isCustom = config !== null && (chosen === null || wantsCustom);
  return (
    <>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Grid">
        {PRESET_IDS.map((id) => (
          <Choice
            key={id}
            label={PRESETS[id].label}
            hint={`${String(PRESETS[id].linesToWin)} lines to win`}
            isChecked={!isCustom && chosen === id}
            disabled={config === null}
            onChoose={() => {
              if (config === null) return;
              setWantsCustom(false);
              const { size, linesToWin } = PRESETS[id];
              sendBingo({ ...config, size, linesToWin });
            }}
          />
        ))}
        <Choice
          label="Custom"
          hint={
            isCustom
              ? `${String(config.size)}×${String(config.size)}, ${String(config.linesToWin)} lines`
              : "Your own size and lines"
          }
          isChecked={isCustom}
          disabled={config === null}
          onChoose={() => {
            setWantsCustom(true);
          }}
        />
      </div>
      {isCustom && (
        <div className="flex flex-col gap-3">
          <SegmentedControl
            label="Grid size"
            options={SIZE_OPTIONS}
            value={String(config.size)}
            onChange={(size) => {
              sendBingo(withGrid(config, { size: Number(size) }));
            }}
          />
          <LinesStepper
            value={config.linesToWin}
            max={lineCountFor(config.size)}
            onChange={(linesToWin) => {
              sendBingo(withGrid(config, { linesToWin }));
            }}
          />
          <p className="text-small text-pencil">
            A {config.size}×{config.size} grid has {lineCountFor(config.size)} lines in all. Only
            Classic 5×5 counts for the leaderboard.
          </p>
        </div>
      )}
      {config !== null && (
        <div className="flex flex-col gap-2">
          <SegmentedControl
            label="Turn clock"
            options={TIMER_OPTIONS}
            value={config.timer}
            onChange={(timer) => {
              sendBingo({ ...config, timer });
            }}
          />
          <p className="text-small text-pencil">{TIMERS[config.timer].hint}</p>
        </div>
      )}
    </>
  );
}

/** "Lines to win: − 5 +". Buttons stop at 1 and at the most the grid has. */
function LinesStepper({
  value,
  max,
  onChange,
}: {
  readonly value: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
}) {
  const step =
    "grid size-11 place-items-center rounded-pill bg-well text-title font-semibold text-ink transition-transform duration-(--duration-press) ease-out active:scale-97 focus-visible:outline-2 focus-visible:outline-pen disabled:opacity-40 motion-reduce:active:scale-100";
  return (
    <div role="group" aria-labelledby="lines-label" className="flex items-center gap-3">
      <span id="lines-label" className="flex-1 text-body text-ink">
        Lines to win
      </span>
      <button
        type="button"
        aria-label="Fewer lines"
        disabled={value <= 1}
        onClick={() => {
          onChange(value - 1);
        }}
        className={step}
      >
        −
      </button>
      <output
        aria-live="polite"
        className="w-8 text-center text-title font-bold tabular-nums text-ink"
      >
        {value}
      </output>
      <button
        type="button"
        aria-label="More lines"
        disabled={value >= max}
        onClick={() => {
          onChange(value + 1);
        }}
        className={step}
      >
        +
      </button>
    </div>
  );
}

const LENGTH_OPTIONS = Array.from({ length: MAX_LENGTH - MIN_LENGTH + 1 }, (_, i) => {
  const value = String(MIN_LENGTH + i);
  return { value, label: `${value} letters` };
});

export function WordGuessSettings({ room }: { readonly room: RoomMessage }) {
  const parsed = wordGuessConfigSchema.safeParse(room.gameConfig);
  if (!parsed.success) return null;
  const config = parsed.data;
  const guessOptions = Array.from({ length: MAX_GUESSES - config.length + 1 }, (_, i) => {
    const value = String(config.length + i);
    return { value, label: value };
  });
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label="Word length"
        options={LENGTH_OPTIONS}
        value={String(config.length)}
        onChange={(value) => {
          const length = Number(value);
          // As many guesses as letters by default; never fewer than letters.
          sendWordGuess({ length, maxGuesses: Math.max(length, config.maxGuesses) });
        }}
      />
      <SegmentedControl
        label="Guesses"
        options={guessOptions}
        value={String(config.maxGuesses)}
        onChange={(value) => {
          sendWordGuess({ ...config, maxGuesses: Number(value) });
        }}
      />
      <p className="text-small text-pencil">
        Each of you picks an everyday word for the other to guess. Fewer guesses wins.
      </p>
    </div>
  );
}

/** The host's settings panel per game; a new game must add its own here (the type requires it). */
export const GAME_SETTINGS: Readonly<
  Record<GameId, (props: { readonly room: RoomMessage }) => React.ReactNode>
> = {
  bingo: BingoSettings,
  "word-guess": WordGuessSettings,
};
