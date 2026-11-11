# Frontend engineering standards

Scope: `apps/web`, `packages/ui`, `packages/games/*/ui`. **If this file disagrees with
[AGENTS.md](../../AGENTS.md) or [design-direction.md](../design/design-direction.md), those two win.**
Motion details live in [motion.md](motion.md).
Research (2026-11-10): vercel-react-best-practices, nextjs-app-router-patterns, web-design-guidelines,
frontend-design and mobile-native skills, the repos under Sources, and ShiftBuddy-Web's README.

## Principles

1. **Server components by default, client components at the leaves.** Less JS means better LCP and INP on mid-range Android.
2. **Every kind of state has exactly one owner:** server data, live room state and UI state each live in one place.
3. **Organise by feature, not by type.** A game can be removed by deleting its folder. *(bulletproof-react)*
4. **The client renders views and sends intents.** It never decides results.
5. **Validate every boundary with zod:** socket messages, API responses, forms, and `sessionStorage`.
6. **Platform CSS before JS:** `dvh`, `env()`, `(hover)` queries, `overscroll-behavior`.
7. **Test what the user sees:** query by role and label. *(testing-library)*

## Folder structure

```text
apps/web/src/
  app/                       routes only: thin page/layout; loading/error/not-found per segment
    (marketing)/page.tsx     landing
    r/[code]/page.tsx        room preview + join
    room/[code]/page.tsx     live room (client island)
    (account)/profile, leaderboard
    admin/                   layout.tsx checks isAdmin on the server
    api/                     route handlers
  features/<area>/           room, lobby, voice, profile, leaderboard, admin, auth
    components/ hooks/ api/ utils/ schemas.ts types.ts
  lib/                       room-client/, auth-client.ts, query-client.ts, env.ts, notify.ts, log.ts
  proxy.ts                   cheap redirects only, never the source of truth for auth
packages/ui/src/
  tokens.css                 Tailwind v4 @theme, the single source for all tokens
  primitives/                Button, IconButton, TextField, CodeInput, Sheet, Dialog, Menu, Tooltip, Toast…
  motifs/                    InkRing, TimerRing, SpeakingRing
  room/                      SeatGrid, VoiceDock, TurnRail, CalledNumber… (props only)
packages/games/<game>/ui/
  index.ts                   one lazy entry: <GameView view intents viewer />
  components/ hooks/ a11y.ts *.test.tsx
```

- Imports flow one way: `app` → `features` → `packages/ui` / `games/*/ui` → `engine` / `protocol`.
  A feature never imports another feature's internals.
- `packages/ui` and the game UIs never import Next, the room client or the network. Data comes in as
  props and intents go out as callbacks.
- No barrel files inside `apps/web`. Each package has one public `index.ts`.

## Server vs client components

- `page.tsx` and `layout.tsx` are server components. They check auth, read data through
  `features/*/api`, and pass minimal serialisable props down.
- Put `"use client"` on the smallest wrapper that needs state, effects, browser APIs, Motion, LiveKit
  or the socket. Pass server content through as `children`.
- The live room is one client island (`features/room/RoomScreen.tsx`), and its shell is rendered on the server.
- `next/dynamic({ ssr:false })` is only allowed inside a client component.
- Request APIs are async (`params`, `searchParams`, `cookies()`, `headers()`), so always `await` them.
- With `cacheComponents`, client state can survive a navigation (a lesson from ShiftBuddy-Web).
  Reset busy flags and fields after success.
- Mutations go through Server Actions or route handlers that check auth again.
- Run independent reads with `Promise.all`, and wrap slow sections in `<Suspense>` with a skeleton.

## State management

| Kind | Tool | Examples |
|---|---|---|
| Server data (HTTP) | RSC fetch for the first paint, **TanStack Query** when refetching or polling | leaderboard, history, admin live rooms (5 s poll) |
| Live room state | **RoomClient → a small Zustand store per room**, read through selectors | seats, phase, host, voice flags, `{seq, view}`, connection status, outbox |
| URL state | **nuqs** | leaderboard filters, admin tabs, game picker |
| Local UI | `useState` / `useReducer` | sheet open, focused cell, input text |
| Voice media | LiveKit React hooks inside `features/voice` | speaking level, mic |

Never copy socket state into Query, or Query data into Zustand. Subscribe to derived primitives
(`useRoom(s => s.isMyTurn)`). Derive values during render instead of syncing them in effects.
High-frequency values go to refs or CSS variables, never to React state.

## Realtime client patterns

- **`lib/room-client/` is the only code that talks to Colyseus.** It exposes `connect`, `sendIntent`,
  `leave` and `subscribe`, plus the store. Every inbound message is zod-parsed, and an invalid one is
  dropped and counted.
- **Ordering:** apply a `game` message only when `seq === last + 1`. On a gap, send `resync` and keep
  showing the stale view until the full view arrives. A lower `seq` is ignored.
- **Outbox:** each intent carries a `clientActionId` and `turnSeq` and stays in the outbox until
  acknowledged. After a reconnect the outbox is resent first. A rejected intent is dropped and the user sees an inline toast.
- **Checkpoint:** the latest sealed blob is kept opaque in `sessionStorage` under one versioned key.
  On close `restarting`, wait 2–5 s with jitter, reconnect, then send `resume`.
- **Connection status:** `connecting | live | reconnecting | resuming | closed`. While reconnecting,
  show "Reconnecting… your seat is held for 60s", disable intents and keep the board visible.
- **Optimistic UI only for your own reversible local marks:** the setup taps and the letters you
  type. Calls, guesses, wins, turns, host actions and results always wait for the server.
- **Timer:** the countdown runs toward the server `deadline`, corrected by the clock offset measured at join.
- Clean up on unmount and on `pagehide`. On `visibilitychange`, reconnect if the socket died.

## Forms

- Each feature has `features/<area>/schemas.ts`, shared by the client and the Server Action. The
  server parses the input again.
- Small forms (join, nickname, code) use a native form with `useActionState`. Larger forms use
  react-hook-form with `zodResolver`.
- Errors appear inline under the field (`aria-describedby`, `aria-invalid`), and focus moves to the
  first invalid field. The submit button stays enabled.
- Inputs use at least 16px text. The nickname field uses `autocomplete="nickname"`. The code field uses
  `autocapitalize="characters" spellcheck=false enterkeyhint="go"`, and pasting always works.
- Outcomes are shown with Sonner via `lib/notify.ts`, and questions with Base UI dialogs. Never `alert` or `confirm`.

## Styling

- All tokens live in `packages/ui/tokens.css` (`@theme`). Dark mode overrides the same variables.
- Use token utilities (`bg-sheet text-ink`). **No arbitrary `[...]` values** unless a comment explains
  why (for example `clamp()` or `env()`). No hex colours in components.
- Use `cn()` (clsx + tailwind-merge) and typed variants (cva). Base UI handles behaviour and our classes
  handle the look, with states targeted through `data-*` attributes.
- Hover styles go only under `(hover:hover) and (pointer:fine)` (a `pointer-fine` custom variant).

## Accessibility

- WCAG 2.2 AA: every control has an accessible name, a 44px target, and a `:focus-visible` ink ring.
- The Bingo board is `role="grid"` with a roving tabindex, arrow keys and Enter. Word Guess uses the
  physical keyboard. Keyboard actions never animate.
- Colour is never the only signal: each cell and tile gets an `aria-label` from `ui/a11y.ts`.
- One polite `aria-live` region per room announces turns, "5 s left", calls, lines and the result.
  Errors use an assertive region.
- Never disable zoom. Run axe in Playwright on every route.

## Performance budgets (p75, mid-range Android, 4G)

| Metric | Budget |
|---|---|
| LCP | ≤2.5 s |
| INP | ≤200 ms (cell tap feedback ≤100 ms) |
| CLS | ≤0.1 |
| First-load JS (gzip) | landing ≤120 KB · room shell ≤170 KB · each game chunk ≤60 KB · admin code-split |

- Each game UI is loaded with `next/dynamic` from the registry. `livekit-client` loads on the first
  voice tap. Recharts and TanStack Table load only in `/admin`.
- Fonts use `next/font/google` (Bricolage Grotesque, Figtree) with subsets and only the weights in use.
  Raster images go through `next/image`, glyphs are inline SVG.
- Report web vitals with `useReportWebVitals`. CI fails when a JS budget is exceeded.

## Mobile web

- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`.
  Set `themeColor` per scheme and `color-scheme`.
- The app shell uses `100dvh` and the landing hero `100svh`. The dock, sheets and toasts use
  `env(safe-area-inset-*, 0px)`.
- Remove `-webkit-tap-highlight-color`. Set `overscroll-behavior: none` on the root and `contain` on
  inner scrollers. Use `touch-action: manipulation` and `user-select: none` on controls only.
- **iOS Safari audio:** join with the mic off. Call `room.startAudio()` and `getUserMedia` only inside
  a tap handler. When `canPlaybackAudio` is false, show "Tap to hear the room". Check it again after
  every reconnect and when the app comes back from the background.
- Invites use the Web Share API, with a copy-link fallback. Test on a real iPhone and a mid-range Android.

## Error, loading & empty states

- Every segment has `loading.tsx` (a skeleton, not a spinner) and `error.tsx`. A wrong or closed room
  goes to `not-found.tsx`.
- Each game view has its own error boundary ("Reload game"), so the room and voice survive a game crash.
- These states must be designed: empty seats, no matches yet, "needs 10 games", reconnecting, server
  restarting, room closed by host, mic denied (with "Open settings" steps), voice unavailable.
- Never show raw server or library text. Log the details and show a mapped message.

## Testing

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | room-client seq/gap/outbox logic, reducers, utils, schemas |
| Component | Vitest + Testing Library + user-event | board keyboard navigation, tile aria labels, forms, states |
| Network mocks | MSW | HTTP read APIs |
| E2E | Playwright | CUJs with multiple browser contexts. Projects: WebKit iPhone, Pixel, desktop Chrome. Axe + web-vitals checks. LiveKit is faked |

Tests tagged `@smoke` and `@critical` run on every PR. The full suite runs on `dev` → `main`.

## Naming & style

- Files kebab-case. Components PascalCase. Hooks `useX`. Schemas `xSchema` with the inferred type `X`.
  Props `onX`, handlers `handleX`. Booleans start with `is`/`has`/`can`.
- Named exports only, except where Next requires a default export.
- Strict TypeScript: no `any`, no unexplained `!`, discriminated unions with an exhaustive `never` check.
- Components stay under about 150 lines. Never define a component inside another. Use ternaries
  instead of `&&` in JSX. No `console.log` (use `lib/log.ts`). Use the `en-IN` locale with `Intl`.
- Buttons use Title Case, headings use sentence case.

## Sources (stars as of 2026-11-10)

vercel/next.js 143.5k · shadcn-ui/ui 127.9k (patterns) · microsoft/playwright 99.8k ·
tailwindlabs/tailwindcss 98.7k · pmndrs/zustand 58.9k · TanStack/query 50.6k · react-hook-form 44.9k ·
colinhacks/zod 44.3k · alan2207/bulletproof-react 36.1k · motiondivision/motion 35.1k ·
vercel-labs/agent-skills 33.9k · testing-library/react-testing-library 19.7k · mswjs/msw 18.3k ·
vitest 17.4k · sonner 13.2k · mui/base-ui 11.4k · 47ng/nuqs 10.9k · GoogleChrome/web-vitals 8.7k ·
dequelabs/axe-core 7.8k · LiveKit StartAudio docs.
