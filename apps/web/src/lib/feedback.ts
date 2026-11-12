"use client";

/**
 * The three sounds and their haptics (design-direction: your turn, a line, a win), fired on the
 * same frame as the visual change they belong to. Quiet by design, and both can be switched off
 * in Settings. Vibration works on Android; iOS browsers have no vibration API, so it is skipped.
 */

export type FeedbackEvent = "turn" | "line" | "win";

/** Each note: frequency in Hz and when it starts, in seconds. */
const NOTES: Readonly<Record<FeedbackEvent, readonly (readonly [number, number])[]>> = {
  turn: [
    [660, 0],
    [880, 0.09],
  ],
  line: [[784, 0]],
  win: [
    [523, 0],
    [659, 0.11],
    [784, 0.22],
    [1047, 0.33],
  ],
};

const VIBRATION: Readonly<Record<FeedbackEvent, number | number[]>> = {
  turn: 12,
  line: [18, 40, 18],
  win: [30, 60, 30, 60, 60],
};

const VOLUME = 0.06;
let context: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    // Browsers start audio suspended until a tap; any earlier tap on the page unlocks it.
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

function play(event: FeedbackEvent): void {
  const ctx = audio();
  if (ctx === null) return;
  for (const [frequency, at] of NOTES[event]) {
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    // A soft attack and a quick decay: a pencil tap, not a beep.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(VOLUME, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  }
}

export function giveFeedback(
  event: FeedbackEvent,
  options: { sound: boolean; haptics: boolean },
): void {
  if (options.sound) play(event);
  if (options.haptics && typeof navigator.vibrate === "function")
    navigator.vibrate(VIBRATION[event]);
}
