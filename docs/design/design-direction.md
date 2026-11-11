# Design direction: "Last page of the notebook"

Source: design agent using `ui-ux-pro-max:design-system`, `frontend-design`, `design-taste-frontend`,
`emil-design-eng`, `interface-design`, `web-design-guidelines` (2026-11-10).
Rejected the ui-ux-pro-max suggestion (felt green + gold, 3D, Nunito) because it reads as casino/kids' app.

## Concept

Every Indian friend group played Bingo on the back page of a ruled notebook with a blue ballpoint
during a boring lecture. The brand is that page: cool notebook paper, ballpoint-blue ink, the red
margin line, a highlighter. It is lit like a hostel room, not a casino floor.

**One motif: the hand-drawn ink ring** you draw around a called number. It is reused as the
called-number mark, the turn/timer ring, the speaking indicator, the focus ring and the Word Guess
"letter in word" marker. No gradients, no glass, no neon.

## Tokens

### Colour (WCAG 2.x contrast measured)

| Role | Light | Dark | Contrast |
|---|---|---|---|
| `--paper` page | #F5F7FA | #0F1730 | — |
| `--sheet` raised | #FFFFFF | #18223F | — |
| `--well` inputs / absent tiles | #E3E7EF | #222C4A | — |
| `--ink` text | #18213A | #E8ECF5 | 14.9 / 15.0 |
| `--pencil` secondary text | #55607A | #9AA6C2 | 5.9 / 7.3 |
| `--pen` primary / action | #2346C8 (white on it 7.6) | #8FA6FF (navy on it 7.7) | 7.0 / 7.7 |
| `--margin` danger / strike / timer-low | #C42A44 (white on it 5.6) | #FF7A8C | 5.2 / 7.1 |
| `--highlighter` present / attention (fill only) | #FFC93C | #FFC93C | ink on it 10.4 / 11.5 |
| `--cover` landing field | #CBE4F2 | #18223F | ink on it 12.1 |

Lines: `rgba(24,33,58,.10)` light, `rgba(255,255,255,.08)` dark.

Per-game accents, used only on that game's card, board header and result screen: Bingo = margin red
#C42A44, Word Guess = highlighter #FFC93C, reserved = chalk green #23775A and crayon orange #F08A3C.

### Type (Google Fonts)

* Display and game glyphs: **Bricolage Grotesque** 700–800, tracking −0.03em, leading 0.95.
* UI and body: **Figtree** 400/500/600, leading 1.5, tabular numerals for timers, scores and tables.
* Hindi fallback later: **Mukta**.
* Scale: caption 13, small 14, body 16 (inputs 16 to stop iOS zoom), title 20, h2 25, h1 31–39,
  display `clamp(48px,10vw,120px)`, bingo cell `clamp(22px,7vw,34px)`, word tile `clamp(24px,8vw,36px)`.

### Space, radius, elevation

* Spacing (4px base): 4, 8, 12, 16, 20, 24, 32, 40, 56, 80, 120. Phone gutter 16.
* Radii: pill buttons 999, cells 10, tiles 12, cards 16, sheets 24 (top corners). outer = inner + padding.
* Shadows only on floating things (sheet, popover, toast). Surfaces at rest are separated by tone
  (paper → sheet → well).
  Light: `0 0 0 1px rgba(24,33,58,.06), 0 8px 24px -8px rgba(24,33,58,.18)`. Dark: ring only.

### Motion

* Curves: `--ease-out: cubic-bezier(.23,1,.32,1)`, `--ease-move: cubic-bezier(.77,0,.175,1)`,
  `--ease-sheet: cubic-bezier(.32,.72,0,1)`, celebration spring `{duration:.5, bounce:.2}`. Never ease-in.
* Durations: press scale(.97) 120ms · tooltip 150 · popover 180 · sheet 320 in / 220 out · toast 400 ·
  ink-ring draw 280 · line strike 360 · letter stamp spring 420 · grid reveal stagger 60/grid ·
  win sequence ≤1.4s once · timer ring linear real time · keyboard actions 0ms.

## Screens (mobile first)

1. **Landing.** Headline "Your notebook Bingo, now with voice". One pill **Create Room** button and an
   inline "Have a code?" field. On desktop, a working 5×5 board on the `--cover` stage plays itself once.
   Below the fold: both games as real UI fragments, then a closing code field and a block wordmark.
2. **Join (≤2 taps).** `/r/KHJ427` → room preview (avatars, game, "3 of 6 seats", live speaking rings) →
   nickname (prefilled or suggested) → **Join Room**. Users join with the mic off, and mic permission is
   asked only on the first mic tap. When seats are full the button becomes **Join as Spectator**.
   Codes use 6 characters with no 0/O/1/I, shown as `KHJ 427`.
3. **Lobby.** Seat grid with up to 6 circles. Empty seats are dashed "Invite" buttons that open Web
   Share (WhatsApp first). A spectator strip below. A sticky dock with Mic / Speaker / Share / Leave.
   The host has the game picker, a settings sheet, and **Start Game** (disabled, with the reason shown).
   A seat fills with an ink-ring draw.
4. **Bingo.** The board is full width (cells at least 56px at 360px). Above it: the B-I-N-G-O strip and
   the last-called number with the caller's name. Below it: the turn rail with timer rings. During
   setup, cells are tapped in order or filled with Shuffle, and the fill order shows as small pencil
   numerals. Spectators never get grids.
5. **Word Guess.** Rows of tiles and our own keyboard, whose keys show state by colour and glyph. The
   setter holds a covered chip to see the secret and watches the guesser's rows live. Tiles flip with a
   60ms stagger, shape first, then colour.
6. **Results + rematch.** All grids are revealed and the winners are enlarged. Shared wins read
   "Riya & Kabir — BINGO together". Each loser's grid shows "you needed 7". One **Rematch** button with
   a live "4 of 5 ready" count and who starts next.
7. **Profile/history.** Guest banner, per-game stat row, matches grouped by day.
8. **Leaderboard.** Filters in the URL (game · week/month/all time · mode). Players show "needs 10
   games" until qualified. Your own row sticks to the bottom.
9. **Admin.** A dense, borders-only layout built around the live-rooms table (code, game,
   players/spectators, voice, age, idle, **Close Room** with confirmation), with a 25-cell progress
   micro-glyph per row. Analytics tabs.

## Game-feel rules

* **Timer ring** synced to the server deadline. The last 5 s turn `--margin` with seconds inside. On
  your turn the board border becomes `--pen` and the dock says "Your turn".
* **Called number:** ink ring on every grid (280ms) and a light haptic on yours. Numbers you called
  yourself use a heavier pen.
* **Line complete:** pen strike (360ms) and the next letter stamped (spring). Others see "Kabir: 3 lines".
* **Win** (once): the letters fill with ink, the winner's grid lifts, and the other grids flip in with
  a 60ms stagger. No confetti, no coin sounds.
* **Speaking ring:** stroke width follows the audio level in 3 steps, spring-smoothed.
* **Host mute:** the host taps "Mute Riya" and the button reads "Muted — only Riya can unmute". Riya
  sees "Aarav (host) muted you". Others see a normal mute icon.
* **Reduced motion:** 150ms opacity fades only, and the timer is shown as a number.
* **Sound:** 3 sounds (your turn, line, win) at low volume, ducked under voice. Haptics on Android
  only. Both can be switched off.

## `packages/ui` inventory

* **Basics:** Button, IconButton, TextField, CodeInput, SegmentedControl, Sheet, Dialog, Popover/Menu,
  Tooltip, Toast, Avatar, **InkRing** (draw / timer / level modes), StatRow, DataTable, EmptyState, Skeleton.
* **Room:** SeatGrid/Seat, SpectatorStrip, VoiceDock, MicButton, SpeakingRing, HostMenu, ShareRoom,
  TurnRail, TimerRing, CalledNumber.
* **Games:** GameCard, BingoBoard/BingoCell, LetterStrip, WordRow/WordTile, GameKeyboard, ResultsReveal,
  RematchBar, LeaderboardTable, FilterBar.

Libraries: Tailwind v4 (`@theme` tokens), Base UI, Vaul (sheets), Motion, Sonner, LiveKit React hooks
(hooks only, our own UI), nuqs (URL filters), TanStack Table and Recharts (admin), lucide-react.

## Accessibility & quality checklist

- [ ] Word Guess feedback never relies on colour alone. Correct = `--pen` fill + tick notch.
      Present = highlighter + ink ring. Absent = well fill + strike. Each tile has an aria-label
      ("A, in word, wrong place"), and a legend is one tap away.
- [ ] Keyboard play: arrow keys + Enter on the Bingo grid, a physical keyboard for Word Guess.
      Keyboard actions are never animated.
- [ ] Polite live announcements: your turn, 5 s left, "Kabir called 17", line complete, result.
- [ ] `:focus-visible` ink ring on every control, 44px tap targets, named icon buttons.
- [ ] Nickname `autocomplete="nickname"`. Code `autocapitalize="characters"`, `spellcheck=false`, and
      paste always works. Errors say how to fix them.
- [ ] `touch-action: manipulation`, safe-area padding, `overscroll-behavior: contain`, `100dvh`, and
      pinch zoom stays enabled.
- [ ] Filters and tabs in the URL. Destructive actions have Undo or a confirmation.
- [ ] `color-scheme` and `theme-color` set. `Intl` with en-IN. "…" and tabular numerals.
- [ ] Designed states for empty, loading, error and "Reconnecting… your seat is held for 60s".
- [ ] `prefers-reduced-motion`, transform/opacity only, no `transition: all`, interruptible motion.
- [ ] Buttons in Title Case, headings in sentence case, no tracked uppercase labels.
