# Decisions

Append-only. One line per decision: date, the decision, and the reason. Details live in the design doc.

| Date | Decision | Why |
|---|---|---|
| 2026-11-10 | Product = friends' game platform. Each game is a module, and the platform code is shared | Owner wants "same code, only game + stats change" |
| 2026-11-10 | Name: **Heartroom** | Owner's choice ("Mann" = heart). No game app found with this name; trademark/domain check pending |
| 2026-11-10 | Website first (mobile browsers), no native apps | Friends join from a shared link |
| 2026-11-10 | Bingo: shared win when one call completes the target for several players | Owner's rule |
| 2026-11-10 | Bingo: first turn alternates between games in a room (skipping empty seats) | Fairness |
| 2026-11-10 | Bingo: custom grids 3×3…8×8, linesToWin configurable. Only classic 5×5/5 lines is ranked | Owner wants "crazy" modes. Ranking stays meaningful |
| 2026-11-10 | Bingo timer default Fast 15 s, setup 30 s. Room can pick Chill (Nudge) or Away-only | Goldfish UX review |
| 2026-11-10 | Word Guess: both set and both guess, English, 4–7 letters, secret from common list, guesses from valid list, guess limit word length…10, two-pass feedback | Abuse and fairness review |
| 2026-11-10 | Server-authoritative. `view(state, viewer)` is the only exit for state | Hidden info (grids, secret words) |
| 2026-11-10 | Colyseus, one process, no Redis. Plain state + per-viewer messages (no Schema sync) | YAGNI review. Avoids leaking hidden fields |
| 2026-11-10 | Crash recovery = AES-GCM checkpoint held by clients + client outbox with idempotency keys | Free, works for small deterministic games |
| 2026-11-10 | Voice = LiveKit Cloud free tier, opt-in voice, idle disconnect, monthly minutes cap → voice off | Cost review: free tier ≈ 7 games/day |
| 2026-11-10 | Host powers: mute, block mic (server-enforced), kick + ban, lock, new code, knock after start | Safety review |
| 2026-11-10 | Spectators join with voice disconnected; listening and talking are opt-in | Cost + safety |
| 2026-11-10 | Accounts optional: anonymous guest → Google. 18+ only. Store only Google ID + nickname | DPDP Act (under-18 = child) |
| 2026-11-10 | Leaderboard: total wins + win rate, filters. Shared win = 1/k. ≥10 games, ≥3 opponents, pair cap 10/day | Anti-farming |
| 2026-11-10 | *(Proposed, owner to confirm)* Action logs in Postgres jsonb for 30 days, then nulled | No Redis; Bingo logs are 1–2 KB |
| 2026-11-10 | Public GitHub repo. Work on `dev`, releases via PR to `main`, commit every working step | Owner's choice; traceability |
| 2026-11-10 | EGM review fixes (defaults, owner may revise): checkpoint restore = highest seq after a 5 s collection, refused for finished/closed/live rooms, mid-game only with ≥2 humans | Stops the roll-back cheat (a loser resuming an old checkpoint) |
| 2026-11-10 | Deploys restart immediately (no drain); players resume from checkpoints | Fly caps kill_timeout at 300 s and there is one instance |
| 2026-11-10 | LiveKit token TTL 60 s; bans/blocks re-applied on every participant_joined webhook | TTL only limits the first connect |
| 2026-11-10 | Better Auth keeps the Google email (required for linking); drop photo/name/IP/UA. Guest history merges into an existing account too | Better Auth requires an email column |
| 2026-11-10 | Expired seat = server auto-plays it. >2 auto turns → unranked. No human connected for 3 turns → abandoned | Stops self-finishing ranked games |
| 2026-11-10 | 18+ asked once, on the first join screen | One place, consistent with CUJ 2 |
| 2026-11-10 | Phases split: 0 engine only, 2a online (Option C), 2b reconnect/host/PWA, 2c checkpoint (Option A) | Smaller steps for one developer |
| 2026-11-10 | Engineering standards adopted: docs/engineering/{backend,frontend,motion}.md (from top-starred repos + skills) | One reference for every agent and device |
| 2026-11-10 | *(Proposed, owner to confirm)* JS budgets: landing ≤120 KB gz, room shell ≤170 KB, each game ≤60 KB | Mid-range Android on 4G |
| 2026-11-10 | Motion stack: CSS/WAAPI + Motion (LazyMotion), hand-built SVG ink; no GSAP/Lottie/Rive/confetti; Web Audio for 3 sounds | Small bundle, notebook brand |
| 2026-11-10 | Node ≥22.12, ESM, pnpm 12 via corepack | Owner's machines |
| 2026-11-11 | TypeScript 6.0 (not 7) and ESLint 9 (not 10) | typescript-eslint 8 supports TS <6.1; ESLint 10 needs Node ≥22.13 (owner runs 22.12). Revisit when both move |
| 2026-11-11 | Vitest `projects` in root `vitest.config.ts` instead of `vitest.workspace.ts` | The workspace file was removed in Vitest 4 |
| 2026-11-11 | Packages ship TS source with explicit `.ts` import extensions; `@heartroom/engine/testing` is a second entry for test helpers | Works in tsx, Vitest, esbuild and Next; test helpers stay out of runtime imports |
| 2026-11-11 | Contract clarifications: `Deadline.at` = ms after the current turn began; `State` is plain JSON and never mutated; `RuleError` = `{ code: NOT_YOUR_TURN \| RULE_VIOLATION, reason }` | Rules have no clock; `assertNoLeak` compares canonical JSON; reasons map to UI copy |
| 2026-11-11 | `assertNoLeak` also fails if `perturbHidden` mutates the state or never changes anything | Otherwise a lazy `perturbHidden` passes and proves nothing |
| 2026-11-11 | Host commands are a zod discriminated union by `kind` (snake_case); `config` carries `gameId` + opaque config | `target` required exactly where needed; the game's own schema parses config |
| 2026-11-11 | Types use `type`, not `interface` (lint rule) | Views/results must be assignable to `Json`, which interfaces are not |
| 2026-11-11 | `Deadline` gains `key` (a new key restarts the clock) and `onlyWhenAway` | One setup clock shared by all seats; turn clocks restart per call; Away-only mode |
| 2026-11-11 | Bingo setup time is derived from size (`setupMsFor`), not a config field; `firstSeat` is a config field the room rotates | One source of truth; the module stays unaware of empty seats |
| 2026-11-11 | Shuffle = a `fill` action carrying the client's own permutation; Shuffle keeps tapped numbers | `apply` stays free of randomness; it is the player's own grid, so client randomness is fair |
| 2026-11-11 | Chill mode: any other seat can `nudge` once per turn, starting a 30 s clock | Concept brief's "Nudge" as a normal logged action |
| 2026-11-11 | Bot levels: Hard = greedy line progress, Medium = greedy half the time, Easy = random (2,000-seed rates: Hard–Easy 95.9%, Hard–Medium 77.9%, Medium–Easy 67.8%) | Simulation: no smarter plan beat greedy in 1…N² Bingo, and a call reveals nothing about the opponent's grid; the design doc allowed changing levels |
| 2026-11-11 | Non-winners are ranked by lines completed (`placements`) | Gives `result()` a meaningful order without new rules |
| 2026-11-11 | vs Computer uses the Chill timer with no Nudge (no clock for the human) | Offline practice should not rush the player |
| 2026-11-11 | Tooling for the web: Next 16.4 (Turbopack), React 19.3, Tailwind 4.3, eslint-plugin-react-hooks 7, @next/eslint-plugin-next; component tests use happy-dom + Testing Library | Current stable; all work with ESLint 9 / Node 22.12 |
| 2026-11-11 | Looks like ShiftBuddy: themes × light/dark + Auto, Make your own, text size; palettes in TS (`themes.ts`) feed both CSS and a contrast test | Owner's request; one source of truth that can't ship an unreadable theme |
| 2026-11-11 | 8 themes at launch (Notebook default + 7 from the ShiftBuddy families) | Enough choice; more are one entry each |
| 2026-11-11 | Six fixed player colours; a called number is inked in its caller's colour, the viewer's own calls heavier | Owner: boards looked the same and "who did what" was invisible |
| 2026-11-11 | 7×7 and 8×8 call in two taps (pick, then Call or tap again) instead of press-and-hold | Same safety on ~36 px cells, easier to discover, works with keyboard |
| 2026-11-11 | History on the device = (config, seed, actions, players), rebuilt with `replay()`; newest 50 | Shows what really happened; same record the server will store |
| 2026-11-11 | Names: shared `nicknameInput`; unique per room (server, Phase 2), not globally | Friends' rooms need no global namespace |
| 2026-11-11 | No `<form onSubmit>` that can submit natively; function actions or buttons | A pre-hydration tap reloaded the page and could put a name in the URL |
| 2026-11-12 | Q2 closed: Colyseus 0.18 (`@colyseus/core` + `ws-transport`, client `@colyseus/sdk`), plain state + per-viewer messages; zod `safeParse` in handlers, not Colyseus `validate()` | Spike passed; `validate()` disconnects on a bad payload instead of letting us reply with an error |
| 2026-11-12 | Pin exact Colyseus versions (`@colyseus/core` 0.18.28, `ws-transport` 0.18.5, `schema` 5.0.46); install scripts denied for esbuild and msgpackr-extract | Versions the spike ran; neither script is needed (prebuilt binary / pure-JS fallback) |
