# Status

_Update this file at the end of every working session (any agent, any device)._

**Last updated:** 2026-11-12 (#22)
**Phase:** Phase 1 done (owner checked on a phone) + UI redesign + Q2 spike done → Phase 2a in progress (#15–#18, #22, #23 done; next #19 checkpoints).

## Done

- [x] Concept + rules agreed (Bingo 1–25 incl. custom grids, Word Guess, rooms, voice, spectators,
      accounts, leaderboard, admin). See `docs/DECISIONS.md`.
- [x] Goldfish review of the concept (4 lenses), games research and the design system.
- [x] Full design doc drafted: `docs/design/heartroom-design.md`.
- [x] Repo created with agent docs (AGENTS.md, CLAUDE.md), `main` + `dev` branches (main protected).
- [x] Engineering standards written: `docs/engineering/backend.md`, `frontend.md`, `motion.md`.
- [x] **Phase 0** (2026-11-11): pnpm workspace, strict TS, ESLint (purity + import boundaries),
      Prettier, Vitest; `packages/engine` (contract, xoshiro128** Rng, step/replay, `assertNoLeak`,
      `hidden-number` fixture game in `@heartroom/engine/testing`); `packages/protocol` (zod messages,
      `ERROR_CODES`, `CLOSE_CODES`); `packages/ui/src/tokens.css`; `.env.example`.
      77 tests, engine coverage 100% lines / 99% branches.
- [x] **Phase 1** (2026-11-11): `packages/games/bingo` (rules for 3×3…8×8, shared win, fast / chill
      with Nudge / away-only timers, view + `perturbHidden` passing `assertNoLeak`, bot Easy/Medium/Hard,
      UI components), `packages/ui` Button, and `apps/web` (Next 16) with `/` and `/play/bingo`
      (vs Computer, runs fully in the browser). 151 tests; `next build` passes; played in a 375 px browser.
      Owner checked it on a phone: looks good.
- [x] **UI redesign + Phase 1 gaps** (2026-11-11, owner feedback): 8 themes × light/dark + Auto, Make your
      own, text size, player colours; Settings (name, colour, look, sounds); Bingo redesign (numbers inked
      in the caller's colour, players bar, last-call stage, call log, win motion, two-tap call on 7×7/8×8);
      History with step-through replay; sounds/haptics; error/loading states. All recorded in
      `docs/design/ui-system.md`. 211 tests.
- [x] **Fix: Start game on phones** (2026-11-11): `crypto.randomUUID` is missing on `http://<laptop-ip>`;
      ids now come from `newId()`. Owner confirmed on the phone: works.
- [x] **Q2 Colyseus spike** (2026-11-12): Colyseus 0.18 works with plain state + per-viewer messages.
      What the room must do because of it is in the design doc › Sync model › "Q2 spike result" (zod in
      the handler, not `validate()`; `onDrop`/`onReconnect`; SDK reconnect fallback; message rate limit).
- [x] **Phase 2a, first slice** (2026-11-12): `apps/server` boots (Colyseus 0.18 pinned, `tsx`):
      `config.ts` (zod env, names-only errors, no wildcard origin in production), pino logger with
      redaction, `/healthz` (`ok`, `bootId`, `rooms`), WS upgrade refused (403) for an Origin not in
      `ALLOWED_ORIGINS`; `rooms/registry.ts` (`GAMES = { bingo }`), `rooms/codes.ts` (6-char code,
      128-bit link token, `node:crypto`), `rooms/rate-limit.ts` (token buckets, bounded memory);
      `roomCodeInput` in `packages/protocol` for the web join field. 236 tests. Boot, `/healthz` and
      the Origin check were tried against the running server.
- [x] **Phase 2a #16 `GameRoom`** (2026-11-12): one room type for every game; room id = the room code.
      Join checks (dev token, rate limits, bans, lock, unique names with a suggestion, free colour),
      seats/spectators, takeover, 60 s reconnect, host config/start/lock/kick, serial queue, duplicate
      intents re-acked, per-viewer views, deadlines with away-only clocks and auto-play. Close codes
      moved to 4101+ (Colyseus owns 4000–4010). 273 tests, incl. a real-server game with no grid leak.
      `pnpm --filter @heartroom/server dev` now works in PowerShell with no env set.
- [x] **Phase 2a #23 Better Auth** (2026-11-12): `packages/db` (Drizzle; Better Auth tables, SQL in
      `packages/db/drizzle`), `apps/web/src/lib/auth/` (anonymous guests + JWT plugin, no IP/user agent
      kept) and `/api/auth/[...all]`; `getGameToken()` in `lib/auth/client.ts` signs in a guest if needed
      and returns a 15-min EdDSA token. The server checks it with jose against `AUTH_JWKS_URL` (alg,
      `iss`, `aud`, `exp` pinned, 30 s skew); `dev:<id>` still works outside production. Locally the site
      uses PGlite in `.data/pglite` (no Neon needed). Tried for real: guest sign-in → `/token` → the
      server's verifier accepted it and refused a tampered one. 278 tests.
- [x] **Phase 2a #22 web room screens** (2026-11-12): `/play` (start a room, join by code, link to vs
      Computer) and `/r/[code]` (join with name + 18+ once, lobby, game, results, rematch).
      `lib/room-client/` is the only Colyseus code (zustand store, pure `state.ts` with tests, SDK
      auto-reconnect from the first second, outbox resent after a reconnect, refresh rejoins via
      sessionStorage). Room message now has `matchPlayers` (names per game seat, since the room rotates
      seats). `nicknameInput` blocks swearing/slurs (English, Hinglish, Hindi) and reserved names;
      `user.age_confirmed_at` (migration 0001). Played for real in the browser against a scripted second
      player: create → join → 4×4 game → shared win → refresh rejoined → rematch → leave; wrong code shows
      its message; lobby checked at 375 px. 287 tests.

## Next

1. **Owner check of online rooms** on two phones (or a phone + laptop, different browsers so they are
   different guests): run `pnpm --filter @heartroom/server dev` and the site on port 3000
   (`build` + `start`), open `/play` on one, create a room, open the link on the other. Check: join with
   18+, lobby, a 5×5 game, results, rematch, refresh mid-game (same seat), turn Wi-Fi off for 10 s
   (reconnecting bar, then back), Leave.
2. **Owner check of the rest of the redesign** on a phone (Start game already confirmed): Settings (name, colour, every theme in light and dark,
   Make your own, text size), a game at 5×5 and 8×8 (two-tap call), results, History step-through,
   sounds and vibration. Same commands as before (`build`, then `start`, open `/play/bingo`).
3. **Phase 2a**, next steps in order:
   - **#19 checkpoints**, then #20/#21 match persistence + DB (Neon project still to create: Q5).
   - Room UI gaps: no countdown yet, so the host can only pick Chill (needs the deadline in the `game`
     message + clock offset); the room message doesn't carry the config, so after a refresh the host's
     grid picker shows Classic even if Quick is set; views aren't zod-checked (no `viewSchema` on the
     module yet); no knocks UI, no "new code", no voice (Phase 3).
   - Not built yet in the room (answer `NOT_AVAILABLE_YET`): knocks (late joiners are spectators
     for now), new code, mute/block mic (Phase 3), resume (#19), rematch_ready. "Away" means
     disconnected; a hidden tab doesn't count yet (needs a client presence message). Unknown codes
     aren't rate-limited (Colyseus answers before `onAuth`): limit the matchmake route before launch. Run the server (any shell, no env needed in development): `pnpm --filter @heartroom/server dev`.
   The room must honour
   `Deadline.key` / `onlyWhenAway`, give each joiner a free player colour, and keep names unique
   per room (`docs/design/ui-system.md` › Names, Player colours).
4. Still open: Q1 (pricing), Q3 (name check), Q4 (iOS voice), Q5 (server host).

## Phases

| Phase | Scope | State |
|---|---|---|
| 0 | Workspace, engine, protocol, UI tokens | done 2026-11-11 |
| 1 | Bingo rules + vs Computer (offline) | done 2026-11-11 (+ UI redesign) |
| 2 | Rooms (Colyseus) + online Bingo + crash recovery | not started |
| 3 | Voice (LiveKit) + host powers | not started |
| 4 | Google login + history | not started |
| 5 | Word Guess | not started |
| 6 | Leaderboard | not started |
| 7 | Admin dashboard | not started |

## Run locally (any laptop, no .env needed)

1. `pnpm install`
2. Game server (port 2567): `pnpm --filter @heartroom/server dev`
3. Site (port 3000, required: the server checks logins against `localhost:3000`):
   laptop only `pnpm --filter @heartroom/web dev`; for phones `pnpm --filter @heartroom/web build` then
   `pnpm --filter @heartroom/web start`, and open `http://<laptop-ip>:3000/play` on the same Wi-Fi
   (allow Node.js on Private networks in Windows Firewall).
4. A second player needs another browser or an incognito window (tabs of one browser are one guest).
   Local data lives in `.data/pglite` (git-ignored); delete the folder to start fresh.

## Notes for the next session

- The repo is public, so never commit secrets or personal data.
- Tooling pins (see DECISIONS 2026-11-11): TypeScript 6.0 and ESLint 9 on purpose; don't bump to
  TS 7 / ESLint 10 until typescript-eslint supports TS 7 and the owner is on Node ≥22.13.
- A game proves it hides data with `assertNoLeak(module, { scenarios })` from `@heartroom/engine/testing`;
  `hiddenNumber` there is the smallest complete example of a `GameModule`.
- Tailwind only sees workspace packages listed with `@source` in `apps/web/src/app/globals.css`; a
  new package with UI classes must be added there, or its classes silently don't exist.
- Phone testing uses plain `http://<laptop-ip>`, which is not a secure context: APIs like
  `crypto.randomUUID` don't exist there (this broke Start game on 2026-11-11). Test on the phone, not
  only on localhost.
- UI work: read `docs/design/ui-system.md` first; add themes only in `packages/ui/src/theme/themes.ts`
  (the contrast test guards them).
- Before a deploy: `pnpm db:migrate` with `DATABASE_URL_DIRECT` set (Neon direct URL). A schema change =
  edit `packages/db/src/schema.ts`, `pnpm db:generate`, review and commit the SQL.
- Bot strength tests use 2,000 fixed seeds; if a bot change fails them, the levels moved closer together.
