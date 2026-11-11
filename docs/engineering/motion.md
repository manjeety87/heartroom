# Motion and game-feel standards

This file builds on [design-direction.md](../design/design-direction.md) and does not override it.
That file defines the tokens (`--ease-out`, `--ease-move`, `--ease-sheet`) and the ink-ring motif.
Research: emil-design-eng + animation-performance skills, plus the repos listed under Sources (2026-11-10).

## Principles

1. **Animate only with a purpose.** Each animation does one job: feedback (a press), a state change
   (a called number, your turn), spatial continuity (a sheet, a toast), or a rare celebration (a win).
   Pure decoration is cut.
2. **Match motion to frequency.** Keyboard actions and anything that happens hundreds of times get
   0ms. Things that happen tens of times per game (calls, flips, presses) stay ≤360ms and never block
   input. Only the once-per-match win may be long, capped at 1.4s.
3. **Never block play.** Input is never queued behind an animation. A number called mid-animation
   renders its final state at once, and its ring draws on top.
4. **Make motion interruptible.** Anything that can retarget (seat state, speaking ring, press,
   sheets) uses CSS transitions or springs. Keyframes are only for one-shot draws (ring, strike, stamp).
5. **Easing:** entering or drawing uses `--ease-out`, on-screen movement uses `--ease-move`, sheets use
   `--ease-sheet`, and only the timer is linear. Never ease-in. Exits are faster than entries.
6. **Use juice with restraint** ("Juice it or lose it", Jonasson & Purho 2012). Every action gets an
   immediate response: one visual, plus at most one sound and one haptic. No screen shake, particles,
   confetti or coins. The brand is a notebook, not a slot machine.
7. **The server is the truth.** Motion depicts server state. If the two disagree, snap to the server
   state without animating.

## Libraries

| Need | Use | Why (approx. gzip) |
|---|---|---|
| UI motion | **CSS transitions + `@starting-style`** first. **Motion** (`motion/react`) for springs, exits and `layout` | Load Motion via `LazyMotion` + `m` + `domAnimation` (~5kb instead of ~34kb). `useAnimate` mini (~2.3kb) for imperative one-shots |
| Ink ring and pen strike | **Hand-built inline SVG + WAAPI** (`stroke-dashoffset` with `pathLength="1"`). Optionally **perfect-freehand** (~2kb) for heavier pressure strokes | No dependency for the basic ring. The wobble is seeded from the number, so every client draws the same ring |
| Celebrations | Motion springs + CSS | The design forbids confetti |
| Sound | **Plain Web Audio API** (one `AudioContext`, 3 buffers, a `GainNode` for ducking) | 0kb, and it shares the audio graph with LiveKit. Upgrade to howler.js only if needs grow |
| Toasts / sheets | Sonner / Vaul | Keep their default motion |

**Not used:** GSAP (a second runtime that duplicates Motion), react-spring and anime.js (also duplicate
Motion), Lottie and dotLottie (60kb+, needs a designer pipeline, and the art won't match our ink), Rive
(~100kb WASM), canvas-confetti (banned by the design), rough.js (randomness changes on every render, so
our own seeded path is better), use-sound (raw Web Audio is simpler for 3 sounds with ducking).

## Recipes

**Reduced motion (applies to every recipe):** when `prefers-reduced-motion: reduce` is on, every recipe
becomes a **150ms opacity fade of the final state**, and the timer shows as a number.

| Moment | Technique | Animated property | Timing |
|---|---|---|---|
| **Ink ring on called number** | Inline SVG `<path pathLength="1">` ellipse with an overshoot tail and seeded wobble. WAAPI animates `stroke-dashoffset 1→0`. Your own calls use a thicker stroke. A light haptic fires on your grid only | `stroke-dashoffset` | 280ms `--ease-out`. All grids draw at once (no stagger) |
| **Line strike** | SVG path across the line's cells, rotated ±1.5°, in `--margin`. WAAPI dashoffset. Starts after the ring | `stroke-dashoffset` | 360ms `--ease-out`, +40ms |
| **B-I-N-G-O letter stamp** | Ink layer goes from `scale(1.35) rotate(-8deg)`, opacity 0, to `scale(1) rotate(-2deg)`, opacity 1. Motion spring | `transform`, `opacity` | spring `{duration:.42, bounce:.2}` |
| **Word Guess tile flip (shape before colour)** | `rotateX 0→90°` (150ms `--ease-move`). At 90° switch to the revealed face, which shows only the **shape mark** (tick notch / ink ring / strike). Then `90→0°` (150ms `--ease-out`), then the colour fill fades in (120ms). 60ms stagger per tile. The keyboard updates after the last tile. The `aria-label` is set at once | `transform`, `opacity` | row ≈ 4×60 + 420ms |
| **Timer ring** | `remaining = deadline − (Date.now() + serverClockOffset)`. One WAAPI animation runs from the current point to the end with `duration = remaining`, linear. On resync, set `anim.currentTime` (never restart). At ≤5s, switch to `--margin` and show whole seconds | `stroke-dashoffset` | linear, real time |
| **Speaking ring** | Quantize the LiveKit audio level into 3 steps. Write `data-level` to the DOM only when the step changes (no per-frame React state). The ring uses `scale(1 / 1.06 / 1.12)` with opacity | `transform`, `opacity` | 120ms `--ease-out` transition |
| **Win sequence (≤1.4s, once)** | 0ms: letters fill with ink (`clip-path inset(0 100% 0 0)→inset(0)`, 5×80ms stagger) and the win sound plays. 400ms: the winner grid lifts (`translateY(-8px) scale(1.04)`, spring `{.5,.2}`, `drop-shadow` fade). 600ms: other grids flip in (`rotateY 90→0`, 60ms stagger, 300ms). A tap skips to the end state | `clip-path`, `transform`, `opacity` | ≤1.4s |
| **Seat fill** | The dashed Invite circle crossfades to the avatar (`opacity` + `scale(.95→1)`, 180ms), then the ink ring draws (280ms). On leave: 150ms fade, no ring | `opacity`, `transform`, `stroke-dashoffset` | 280ms |
| **Toast** | Sonner defaults. Pauses while the tab is hidden | `transform`, `opacity` | ~400ms in, faster out |
| **Press** | `:active { transform: scale(.97) }` with `transition: transform 120ms var(--ease-out)`. Not animated on keyboard activation | `transform` | 120ms (kept under reduced motion) |

## Performance rules

- **Composite-only:** `transform` and `opacity`, then `clip-path` and `filter`. The one exception is
  `stroke-dashoffset` on small cell-sized SVGs. Never animate `width`, `height`, `top`, `left`, `margin`,
  `padding` or `box-shadow`. Never use `transition: all`.
- **Never animate through React state.** Per-frame values (timer, speaking level, drag) go to
  `ref.style`, a Motion value or WAAPI. No `setState` in rAF, pointer handlers or audio callbacks.
- **No animated inherited CSS variables** on board or grid containers. They force style recalculation on every cell.
- **Prefer off-main-thread drivers** (CSS/WAAPI) for anything that runs while React is busy. In Motion,
  use the `transform` string form rather than `x`/`y` during heavy renders.
- **`will-change` is off by default.** Add it to one element only after a recording proves the need.
  Never on grids or containers.
- **Budget:** 60fps on a mid-range Android (Snapdragon 6-class, Chrome) with 6 voice tracks live, at
  most ~30 elements animating at once, and blur ≤4px.
- **Lazy-load:** Motion features via `LazyMotion`, sound buffers after the first gesture, and
  perfect-freehand only on game routes.

## Sound and haptics

- **Exactly 3 sounds:** your turn, line complete, win. Each is ≤600ms, soft and pencil-like, and all
  three come from one audio sprite of ≤30kb. Gain is 0.3, ducked to 0.1 while anyone speaks (an 80ms
  ramp on the LiveKit active-speaker signal).
- Unlock the `AudioContext` on the first tap and never autoplay. No sound for calls, flips, presses,
  toasts or errors.
- **Haptics:** `navigator.vibrate`, Android only, feature-detected. 10ms for a number called on your
  grid, 20ms for your turn, `[30,40,30]` for a win. Nothing else vibrates.
- Settings have separate **Sound** and **Haptics** toggles, stored per device. Reduced motion does not mute sound.

## Testing motion

1. Watch each recipe at 10% and 25% speed in the DevTools Animations panel. The flip must never flash
   the coloured face before its shape.
2. Turn on reduced motion (DevTools and the device's OS setting). Every recipe should fade, the timer
   should be numeric, and no information should be lost.
3. Interrupt everything: 3 calls within 300ms, a resync during the timer, a tap during the win. Nothing
   restarts or stacks.
4. On a real device, record a 6-player voice game on a mid-range Android: no frame should go over
   16.7ms. On iOS Safari, check the audio unlock and the flip's `backface-visibility`.
5. Keyboard actions play at 0ms.
6. Visual regression: Playwright screenshots of end states with `reducedMotion: 'reduce'`.

## Sources (stars as of 2026-11-10)

motiondivision/motion 35.1k · juliangarnier/anime 74.5k · airbnb/lottie-web 32.4k · greensock/GSAP 30.4k ·
pmndrs/react-spring 29.3k · goldfire/howler.js 25.4k · rough-stuff/rough 21.4k · emilkowalski/sonner 13.2k ·
catdad/canvas-confetti 12.9k · emilkowalski/vaul 8.7k · steveruizok/perfect-freehand 5.8k ·
joshwcomeau/use-sound 3.2k · Motion bundle-size docs (motion.dev/docs/react-reduce-bundle-size) ·
"Juice it or Lose it" (2012) and Steve Swink, *Game Feel* · Wordle-style flip midpoint swap.
