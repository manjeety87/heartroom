"use client";

import {
  bingoConfigSchema,
  CLASSIC,
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

/**
 * The games a room can play and each one's settings, as the lobby shows them. The server checks
 * every config with the game's own schema; this only offers valid ones.
 */

export const ROOM_GAMES = [
  { id: "bingo", label: "Bingo", hint: "2–6 players", min: 2, max: 6 },
  { id: "word-guess", label: "Word Guess", hint: "2 players", min: 2, max: 2 },
] as const;

export type RoomGameId = (typeof ROOM_GAMES)[number]["id"];

export const gameInfo = (id: string | null) => ROOM_GAMES.find((g) => g.id === id) ?? null;

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

/** The room's chosen settings, in words: "Classic 5×5 · Fast", "Word Guess · 5 letters, 5 guesses". */
export function describeSettings(room: RoomMessage): string | null {
  if (room.gameId === "bingo") {
    const parsed = bingoConfigSchema.safeParse(room.gameConfig);
    if (!parsed.success) return null;
    const config = parsed.data;
    const preset = presetOf(config);
    const grid =
      preset === null
        ? `${String(config.size)}×${String(config.size)}, ${String(config.linesToWin)} lines`
        : PRESETS[preset].label;
    return `Bingo · ${grid} · ${TIMERS[config.timer].label}`;
  }
  if (room.gameId === "word-guess") {
    const parsed = wordGuessConfigSchema.safeParse(room.gameConfig);
    if (!parsed.success) return null;
    return `Word Guess · ${String(parsed.data.length)} letters, ${String(parsed.data.maxGuesses)} guesses`;
  }
  return null;
}

/** Picking a game starts from its default settings. */
export function chooseGame(id: RoomGameId): void {
  if (id === "bingo") sendBingo(CLASSIC);
  else sendWordGuess(CLASSIC_WORD_GUESS);
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

export function GamePicker({ room }: { readonly room: RoomMessage }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Game">
      {ROOM_GAMES.map((game) => (
        <Choice
          key={game.id}
          label={game.label}
          hint={game.hint}
          isChecked={room.gameId === game.id}
          onChoose={() => {
            if (room.gameId !== game.id) chooseGame(game.id);
          }}
        />
      ))}
    </div>
  );
}

export function BingoSettings({ room }: { readonly room: RoomMessage }) {
  const parsed = bingoConfigSchema.safeParse(room.gameConfig);
  const config = parsed.success ? parsed.data : null;
  const chosen = config === null ? null : presetOf(config);
  return (
    <>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Grid">
        {PRESET_IDS.map((id) => (
          <Choice
            key={id}
            label={PRESETS[id].label}
            hint={`${String(PRESETS[id].linesToWin)} lines to win`}
            isChecked={chosen === id}
            disabled={config === null}
            onChoose={() => {
              if (config === null) return;
              const { size, linesToWin } = PRESETS[id];
              sendBingo({ ...config, size, linesToWin });
            }}
          />
        ))}
      </div>
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
