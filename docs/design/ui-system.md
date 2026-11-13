# UI system: how Heartroom screens are built

Read this before building or changing any screen. It records what exists in code (2026-11-11) and
the rules behind it. Tokens and values: [design-direction.md](design-direction.md). Engineering
rules: [frontend.md](../engineering/frontend.md) and [motion.md](../engineering/motion.md).
Visual and interaction principles: the `apple-design` skill.

## Principles we apply

1. **Respond on press.** Every control reacts on pointer-down (`active:scale-97`, cells `scale-95`)
   within 100 ms. The result waits for the rules, but the press never waits.
2. **One obvious thing.** Each screen has one primary (pen-filled) button. Everything else is
   `secondary` (well) or `quiet` (text).
3. **Colour is never the only signal.** Every coloured mark also has words for screen readers
   (`aria-label`, `sr-only`) and a shape difference where it matters (your calls are drawn heavier).
4. **Motion explains a change.** Ink draws where a number is called, a letter stamps when a line
   completes, results rise in the order they matter. Nothing loops and nothing decorates. Under
   reduced motion, all of it becomes a 150 ms fade.
5. **Respect the person's settings:** theme, light/dark/auto, text size, reduced motion, reduced
   transparency and increased contrast (the app bar turns solid for the last two).
6. **Wayfinding.** The translucent app bar (Play · History · Settings) is on every page. Pages
   don't add their own "Home" links.
7. **Forgiving.** Destructive actions take a second, clearly worded tap ("Delete game"). Moves that
   are easy to fumble take two steps (calling a number on a 7×7 or 8×8 grid).

## Looks (themes)

| Piece | Where | Notes |
|---|---|---|
| Palettes | `packages/ui/src/theme/themes.ts` (`THEMES`) | 8 themes × light/dark. **The only place colours are defined.** |
| CSS | `themeCss()` in `theme/css.ts`, injected by `apps/web/src/app/layout.tsx` | `:root[data-theme][data-mode]` blocks + custom + text size |
| Before first paint | `THEME_BOOT_SCRIPT` (same file), inline in `<head>` | Reads JSON values from localStorage; ignores anything malformed |
| Make your own | `theme/custom.ts` | 4 colours per side (page, board, text, accent); the rest is derived |
| Runtime | `apps/web/src/lib/look.ts` | `setThemeId`, `setMode`, `setTextSize`, `saveCustomTheme`, `useFollowSystemMode` |
| Defaults | `tokens.css` `@theme` | Notebook light, so a page without JS still looks right |

**Add a theme:** add an entry to `THEMES`. `themes.test.ts` fails unless ink ≥ 7:1, pencil ≥ 4.5:1,
pen and margin ≥ 3:1 on paper and sheet, on-pen text ≥ 4.5:1, and every player colour ≥ 3:1 on the
board, for both sides. Components never use hex values; they use token utilities (`bg-sheet`,
`text-ink`, `ring-pen`).

Storage keys: `heartroom.theme`, `heartroom.mode`, `heartroom.textSize`, `heartroom.customTheme`
(+ `.source`). Values are JSON.

## Player colours

- Six fixed colours (`SEAT_COLORS`: indigo, coral, teal, amber, violet, green), with light and dark
  values as `--color-seat-*` tokens. They are the same in every theme, so a player keeps their
  colour whatever look each friend picked.
- A player picks theirs in Settings. vs Computer: the computer takes the first colour you didn't pick.
  **Rooms (Phase 2):** a joiner whose colour is taken gets the next free one; the server decides.
- Where a colour appears: the player's dot in `PlayersBar`, `CallLog`, results and History; the ring
  around every number they call (on every board); the turn ring around their chip.

## Names

- Rules: `nicknameInput` in `packages/protocol` (NFC, trimmed, spaces collapsed, 1–20 characters,
  at least one letter or digit). The web form and, later, the room server use the same schema.
- `nicknameInput` also refuses swearing and slurs (English, Hinglish, Devanagari) and names that pose
  as staff (admin, host, Heartroom…): "Pick a friendlier name." / "That name is reserved."
- vs Computer refuses "Computer". **Rooms (Phase 2):** names are unique per room; the server refuses a
  duplicate on join with a suggestion ("Riya 2"). Accounts (Phase 4) do not make names globally unique.

## Components

| Package | Component | Purpose |
|---|---|---|
| `@heartroom/ui` | `Button` | primary / secondary / quiet pill, ≥44 px |
| | `SegmentedControl` | Native radios with a sliding thumb (Auto/Light/Dark, levels) |
| | `Switch` | `role="switch"`, whole row is the target |
| `@heartroom/bingo/ui` | `BingoGame` | The whole Bingo screen for one viewer: view in, intents out |
| | `BingoBoard` | Grid with roving tabindex, ink marks by caller, line strikes, two-tap select |
| | `PlayersBar`, `PlayerDot` | Who is playing, their colour, progress, whose turn |
| | `CallLog` | Every call in order, coloured by caller ("who did what") |
| | `LineProgress` | B-I-N-G-O for 5 lines, otherwise rings + "3 / 6" |
| | `ResultsReveal` | Headline, every grid, "Needed N more lines", Rematch |
| | `SetupBar` | Tap in order / Shuffle (keeps tapped numbers) / Clear / Ready |
| `apps/web` | `AppShell` | Translucent app bar + system-mode follower |
| | `features/room/*` | `PlayStart`, `NameStep` (name + 18+ once), `RoomScreen`, `Lobby`, `RoomGame`, `ShareRoom`, `TurnClock` |
| | `features/settings/AccountSection` | Guest / Google states, 18+ box before "Sign in with Google", Sign out; loading, error and failed-return states |
| | `features/history/OnlineGames` | Totals chips per game, then online games ("Shared win with Riya, Kabir", grid, date); empty → Play with friends |
| `@heartroom/word-guess/ui` | `WordTile` / `WordRow` | Right place = pen + tick notch; in word = highlighter + ink ring; not in word = well + strike; aria-label per tile |
| | `GameKeyboard` | On-screen QWERTY (Enter, ⌫) + physical keys; keys show the best known mark |
| | `WordGuessGame` | Choose a word → guess theirs + watch theirs live (own word behind Show/Hide) → reveal; spectator = mark patterns |
| | `features/room/GameSettings` | Game picker + per-game settings (Bingo presets/clock, Word Guess length/guesses) |
| | `features/voice/VoiceDock` | Sticky bottom dock: Join voice (mic off) → Mic / Sound / Leave voice; a chip per person in voice (speaking ring + "speaking" / "mic off" in words); host Block mic / Allow mic on each chip; blocked banner; "Tap to hear voice" (iOS) |
| | `ErrorState` | Crash screen with one way forward |

Game UIs take data as props and emit intents. They never import Next, storage or the network,
so vs Computer, the room and History reuse them unchanged.

## Motion (tokens in `tokens.css`)

| Token | Use | Duration / curve |
|---|---|---|
| `animate-ink-draw` | A called number's ring | 280 ms ease-out |
| `animate-line-strike` | A completed line | 360 ms ease-out |
| `animate-stamp` | A letter or result headline landing | 420 ms `--ease-spring` (the one place with overshoot) |
| `animate-rise` | Items entering in order (results, "Call N") | 320 ms ease-out, 60 ms stagger |
| `animate-lift` | The winner's grid, once | 500 ms spring |
| `animate-fade-in` | Every reduced-motion replacement | 150 ms linear |
| press | `active:scale-97` / `95` | 120 ms ease-out |

Never `transition: all`, never ease-in, animate only transform/opacity/colour. Keyboard actions
don't animate.

## Sound and haptics

`apps/web/src/lib/feedback.ts`: three events (your turn, a line, a win), quiet Web Audio tones and
Android vibration, on the same frame as the visual change. Both switch off in Settings.
Derive events from views (`use-bingo-feedback.ts`), never from intents.

## History

Finished games are stored on the device as `(config, seed, actions, players)` and rebuilt with the
engine's `replay()`, so History shows what really happened, step by step. Online games will use the
same record from the server (Phase 4).

## Patterns to copy

- **Per-device values:** `lib/stored.ts` (`useStored` / `writeStored`) with a zod schema. Never read
  `localStorage` directly.
- **Forms:** a `<form action={fn}>` (React 19 blocks a native submit before hydration) or plain
  buttons. Never a `<form onSubmit>` that could submit natively and put data in the URL.
- **No secure-context-only APIs** (`crypto.randomUUID`, `navigator.clipboard`, `navigator.share`…)
  without a fallback: phones test the app at `http://<laptop-ip>:3000`, which is not a secure
  context. Ids come from `newId()` (`lib/id.ts`); ESLint blocks `crypto.randomUUID` in `apps/web`.
- **Empty states** offer the next action ("No games yet" → Play vs Computer).
- **Live regions:** the last call, turn text and statuses are `aria-live="polite"`.

## Checklist for a new screen

- [ ] Uses token utilities only; checked in light, dark and one non-default theme.
- [ ] One primary action; destructive actions confirm.
- [ ] Every control ≥ 44 px, focus-visible ring, keyboard path.
- [ ] Reduced motion / transparency / contrast checked.
- [ ] Loading, error and empty states designed.
- [ ] Checked at 375 px wide.
