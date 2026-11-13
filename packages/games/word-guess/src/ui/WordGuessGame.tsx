import { useCallback, useState } from "react";
import { Button } from "@heartroom/ui";
import type { WordGuessAction } from "../rules.ts";
import type { WordGuessSeatView, WordGuessSpectatorView, WordGuessView } from "../view.ts";
import { GameKeyboard, letterMarks, WordRow } from "./tiles.tsx";

export type WordGuessPlayer = { readonly name: string; readonly color: string };

export type WordGuessGameProps = {
  readonly view: WordGuessView;
  /** Name and colour per game seat; the viewer's own seat is usually named "You". */
  readonly players: readonly WordGuessPlayer[];
  readonly onIntent: (action: WordGuessAction) => void;
  /** e.g. a refused word, or "Reconnecting…". */
  readonly status?: string;
  readonly onRematch?: () => void;
};

/**
 * The whole Word Guess screen for one viewer: choose a word, guess theirs while watching them guess
 * yours, then the reveal. It renders a view and emits intents; the room decides what is allowed.
 */
export function WordGuessGame({ view, players, onIntent, status, onRematch }: WordGuessGameProps) {
  return (
    <div className="flex flex-col gap-4">
      {view.kind === "seat" ? (
        <SeatScreen
          view={view}
          players={players}
          onIntent={onIntent}
          {...(onRematch ? { onRematch } : {})}
        />
      ) : (
        <SpectatorScreen view={view} players={players} {...(onRematch ? { onRematch } : {})} />
      )}
      {status && (
        <p aria-live="polite" className="text-center text-small text-pencil">
          {status}
        </p>
      )}
    </div>
  );
}

const nameOf = (players: readonly WordGuessPlayer[], seat: number) =>
  players[seat]?.name ?? (seat === 0 ? "Player 1" : "Player 2");

/** The letters being typed, kept per row so a sent guess clears it without an effect. */
function useDraft(row: number, length: number) {
  const [draft, setDraft] = useState({ row, letters: "" });
  const letters = draft.row === row ? draft.letters : "";
  const onLetter = useCallback(
    (letter: string) => {
      setDraft((d) => {
        const current = d.row === row ? d.letters : "";
        return { row, letters: current.length < length ? current + letter : current };
      });
    },
    [row, length],
  );
  const onBackspace = useCallback(() => {
    setDraft((d) => ({ row, letters: (d.row === row ? d.letters : "").slice(0, -1) }));
  }, [row]);
  return { letters, onLetter, onBackspace };
}

function SeatScreen({
  view,
  players,
  onIntent,
  onRematch,
}: {
  readonly view: WordGuessSeatView;
  readonly players: readonly WordGuessPlayer[];
  readonly onIntent: (action: WordGuessAction) => void;
  readonly onRematch?: () => void;
}) {
  const them = nameOf(players, 1 - view.you);
  const isChoosing = view.phase === "setup" && view.yourSecret === null;
  const isGuessing = view.phase === "guessing" && !view.youFinished;
  // Row 0 while choosing; afterwards the next guess row (a sent guess moves the draft on).
  const row = isChoosing ? -1 : view.yourGuesses.length;
  const { letters, onLetter, onBackspace } = useDraft(row, view.length);
  const [isGivingUp, setIsGivingUp] = useState(false);
  const onEnter = useCallback(() => {
    if (letters.length !== view.length) return;
    onIntent(isChoosing ? { type: "set", word: letters } : { type: "guess", word: letters });
  }, [letters, view.length, isChoosing, onIntent]);

  if (view.phase === "done")
    return <Reveal view={view} players={players} {...(onRematch ? { onRematch } : {})} />;

  if (view.phase === "setup") {
    return (
      <section className="flex flex-col items-center gap-4">
        {isChoosing ? (
          <>
            <p className="text-center text-body text-ink">
              Choose a {view.length}-letter word for {them} to guess.
            </p>
            <WordRow length={view.length} word={letters} label="Your word" />
            <p className="text-center text-small text-pencil">
              An everyday English word. Press Enter to lock it in.
            </p>
            <GameKeyboard
              marks={new Map()}
              disabled={false}
              onLetter={onLetter}
              onEnter={onEnter}
              onBackspace={onBackspace}
            />
          </>
        ) : (
          <>
            <SecretChip word={view.yourSecret ?? ""} />
            <p aria-live="polite" className="text-center text-body text-pencil">
              {view.theyHaveSet ? "Starting…" : `Waiting for ${them} to choose a word…`}
            </p>
          </>
        )}
      </section>
    );
  }

  const left = view.maxGuesses - view.yourGuesses.length;
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="your-guesses" className="flex flex-col items-center gap-3">
        <h2 id="your-guesses" className="font-display text-title font-bold tracking-tight text-ink">
          Guess {them}’s word
        </h2>
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: view.maxGuesses }, (_, i) => {
            const guess = view.yourGuesses[i];
            if (guess)
              return (
                <WordRow
                  key={i}
                  length={view.length}
                  word={guess.word}
                  marks={guess.marks}
                  label={`Guess ${String(i + 1)}`}
                />
              );
            return (
              <WordRow
                key={i}
                length={view.length}
                word={i === row && isGuessing ? letters : ""}
                label={i === row ? "Typing" : undefined}
              />
            );
          })}
        </div>
        <p aria-live="polite" className="text-small text-pencil">
          {view.youFinished
            ? view.yourGuesses.at(-1)?.marks.every((m) => m === "correct")
              ? `Solved in ${String(view.yourGuesses.length)}! Waiting for ${them}…`
              : `No guesses left. Waiting for ${them}…`
            : `${String(left)} ${left === 1 ? "guess" : "guesses"} left`}
        </p>
      </section>
      {isGuessing && (
        <>
          <GameKeyboard
            marks={letterMarks(view.yourGuesses)}
            disabled={false}
            onLetter={onLetter}
            onEnter={onEnter}
            onBackspace={onBackspace}
          />
          {isGivingUp ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-small text-pencil">
                You won’t see their word until the end.
              </span>
              <Button
                variant="secondary"
                onClick={() => {
                  onIntent({ type: "give_up" });
                  setIsGivingUp(false);
                }}
              >
                Give up
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  setIsGivingUp(false);
                }}
              >
                Keep guessing
              </Button>
            </div>
          ) : (
            <Button
              variant="quiet"
              className="self-center"
              onClick={() => {
                setIsGivingUp(true);
              }}
            >
              Give up…
            </Button>
          )}
        </>
      )}
      <section
        aria-labelledby="their-guesses"
        className="flex flex-col items-center gap-2 rounded-card bg-sheet p-4"
      >
        <h2 id="their-guesses" className="text-body font-semibold text-ink">
          {them}’s guesses at your word
        </h2>
        <SecretChip word={view.yourSecret ?? ""} />
        <MiniBoard length={view.length} rows={view.theirGuesses} maxGuesses={view.maxGuesses} />
        {view.theyFinished && <p className="text-small text-pencil">{them} is done.</p>}
      </section>
    </div>
  );
}

/** Your own word, covered until you hold it open (someone may be looking at your screen). */
function SecretChip({ word }: { readonly word: string }) {
  const [isShown, setIsShown] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={isShown}
      onClick={() => {
        setIsShown((s) => !s);
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-cover px-4 text-small font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
    >
      Your word:{" "}
      <span className="font-display tracking-widest uppercase">
        {isShown ? word : "•".repeat(word.length)}
      </span>
      <span className="text-pencil">{isShown ? "Hide" : "Show"}</span>
    </button>
  );
}

function MiniBoard({
  length,
  rows,
  maxGuesses,
}: {
  readonly length: number;
  readonly rows: readonly {
    readonly word: string;
    readonly marks: readonly ("correct" | "present" | "absent")[];
  }[];
  readonly maxGuesses: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: maxGuesses }, (_, i) => {
        const r = rows[i];
        return (
          <WordRow key={i} size="small" length={length} word={r?.word ?? ""} marks={r?.marks} />
        );
      })}
    </div>
  );
}

function SpectatorScreen({
  view,
  players,
  onRematch,
}: {
  readonly view: WordGuessSpectatorView;
  readonly players: readonly WordGuessPlayer[];
  readonly onRematch?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-pencil">You’re watching. Words are revealed at the end.</p>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((seat) => (
          <section
            key={seat}
            className="flex flex-col items-center gap-2 rounded-card bg-sheet p-3"
          >
            <h2 className="truncate text-body font-semibold text-ink">{nameOf(players, seat)}</h2>
            {view.secrets && (
              <p className="text-small text-pencil">
                Word:{" "}
                <span className="font-display font-bold uppercase text-ink">
                  {view.secrets[seat]}
                </span>
              </p>
            )}
            <MiniBoard
              length={view.length}
              rows={view.rows[seat] ?? []}
              maxGuesses={view.maxGuesses}
            />
            <p className="text-caption text-pencil">
              {view.phase === "setup"
                ? view.hasSet[seat]
                  ? "Word chosen"
                  : "Choosing…"
                : view.finished[seat]
                  ? "Done"
                  : "Guessing…"}
            </p>
          </section>
        ))}
      </div>
      {view.phase === "done" && onRematch && (
        <Button onClick={onRematch} className="self-center">
          Rematch
        </Button>
      )}
    </div>
  );
}

/** The end: who won, both words, both boards. */
function Reveal({
  view,
  players,
  onRematch,
}: {
  readonly view: WordGuessSeatView;
  readonly players: readonly WordGuessPlayer[];
  readonly onRematch?: () => void;
}) {
  const them = nameOf(players, 1 - view.you);
  const solvedIn = (rows: WordGuessSeatView["yourGuesses"]) =>
    rows.at(-1)?.marks.every((m) => m === "correct") === true ? rows.length : Infinity;
  const mine = solvedIn(view.yourGuesses);
  const theirs = solvedIn(view.theirGuesses);
  const headline = mine === theirs ? "It’s a draw" : mine < theirs ? "You won!" : `${them} won`;
  return (
    <section aria-live="polite" className="flex flex-col items-center gap-4">
      <h2 className="font-display text-h1 font-extrabold tracking-tight text-ink">{headline}</h2>
      <div className="grid w-full grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-2 rounded-card bg-sheet p-3">
          <p className="text-small text-pencil">{them}’s word</p>
          <WordRow size="small" length={view.length} word={view.theirSecret ?? ""} />
          <MiniBoard length={view.length} rows={view.yourGuesses} maxGuesses={view.maxGuesses} />
          <p className="text-caption text-pencil">
            {mine === Infinity ? "You didn’t solve it" : `You: ${String(mine)} guesses`}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-card bg-sheet p-3">
          <p className="text-small text-pencil">Your word</p>
          <WordRow size="small" length={view.length} word={view.yourSecret ?? ""} />
          <MiniBoard length={view.length} rows={view.theirGuesses} maxGuesses={view.maxGuesses} />
          <p className="text-caption text-pencil">
            {theirs === Infinity ? `${them} didn’t solve it` : `${them}: ${String(theirs)} guesses`}
          </p>
        </div>
      </div>
      {onRematch && <Button onClick={onRematch}>Rematch</Button>}
    </section>
  );
}
