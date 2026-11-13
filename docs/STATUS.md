# Status

_Update this file at the end of every working session (any agent, any device)._

**Last updated:** 2026-11-13 (presence; Phase 3 code done)
**Phase:** Phase 2 and Phase 3 code done (owner checks pending, see the owner to-do) → next: **Phase 4** (Google login + history).

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
- [x] **Phase 2a #19 crash recovery** (2026-11-13): `apps/server/src/checkpoint.ts` seals the whole room
      (AES-256-GCM, `CHECKPOINT_KEY`, previous key for rotation, 15 min expiry) after every change and
      every 5 min; the game is kept as config + seed + actions and replayed on restore. Shutdown closes
      with `RESTARTING`; browsers wait 2–5 s and rejoin with `resume` (join option): the room is rebuilt
      under the same code from the newest checkpoint of its seated players (5 s window), a game comes
      back only with 2 of its players, else the lobby. Tested with a real server killed mid-game and a
      new process (same views, older copy can't roll back). Browser: "Bringing your game back…" screen,
      checkpoint kept in sessionStorage (a refresh after a restart works too). 305 tests.
- [x] **Phase 2a #20/#21 match persistence** (2026-11-13): `matches`, `match_players`, `room_events`
      (migration 0002). The game server writes every finished game in the background
      (`persistence/store.ts`, one idempotent transaction): win_share 1/k, ranked only for a ranked
      config (`GameModule.isRanked`; Bingo Classic 5×5) with ≥2 signed-in players, no seat auto-played
      >2 times and the Asia/Kolkata daily pair cap of 10. Room events: created, closed (not on a
      restart), kicked, restored. Restore now refuses a room closed on purpose and never revives a game
      already written; a game lost because only one player came back is recorded as abandoned.
      Development runs a local Postgres (`packages/db/src/dev-server.ts`, PGlite on :5433) shared by the
      site and the server; tests use an in-memory Postgres (`@heartroom/db/testing`). 322 tests.
- [x] **Room gaps closed** (2026-11-13): the server sends a `deadline` message (seat, key, `msLeft`,
      `totalMs`) whenever a clock starts, stops or pauses; the room shows it over the board
      (`features/room/TurnClock.tsx`: "Your call: 0:12", red under 5 s, a shrinking bar that is one CSS
      animation). The host can now pick the turn clock (Fast / Chill / Away only). The room message
      carries `gameConfig`, so the host's picker survives a refresh and other players see the settings.
      Checked in the browser: setup clock, server auto-fill and auto-call when time ran out, turn clock.
      323 tests.
- [x] **Phase 3, first slice: voice** (2026-11-13): `apps/server/src/voice/voice.ts` mints LiveKit tokens
      (room = internal room id, identity = user id, 60 s, mic only, no data/metadata/admin, every flag
      explicit), blocks/allows a mic with `UpdateParticipant`, and removes + revokes on kick or leave.
      `room.micBlocked` (also in checkpoints). Voice is off until `LIVEKIT_URL`/`_API_KEY`/`_API_SECRET`
      are set; refusals are `VOICE_UNAVAILABLE`. Web: `lib/voice/client.ts` (only livekit-client code;
      3-min idle leave, "Tap to hear voice", mic denied / plain-http messages) and
      `features/voice/VoiceDock.tsx` (sticky dock, chips with speaking ring, host Block mic). Checked in
      the browser **without** LiveKit keys (dock + "Voice isn't available" message); real audio not
      tried yet. 329 tests.
- [x] **Phase 3, second slice: voice minutes** (2026-11-13): `POST /livekit/webhook` (signed body
      checked with the API secret, 64 KB max, 404 while voice is off) → `voice_usage` (migration 0003; a
      retried webhook opens no second session; crash leftovers closed at joined_at + 3 h on boot).
      `voice/usage.ts` meter keeps the UTC month's minutes in memory; past `VOICE_MONTHLY_CAP_MINUTES`
      tokens get `VOICE_RESTING` and the dock says "Voice is resting this month". Every
      `participant_joined` asks the room again (`voiceGuards`): not in the room/kicked/banned → removed,
      blocked → listen only. Tested on in-memory Postgres and over real HTTP; real LiveKit webhooks not
      received yet (need a public URL). 338 tests. Restart `pnpm dev` once so the local database gets
      `voice_usage`.
- [x] **Presence** (2026-11-13): client message `presence {isVisible}` on every tab hide/show. A hidden
      tab is away: an "away only" turn clock runs for that player and pauses when they're back. A
      spectator hidden for 3 min is removed from voice; players keep theirs. 339 tests. Phase 3 code is
      done; the phone voice check (owner to-do) closes it.

## Owner to-do (only the owner can do these; tick them here when done)

- [ ] **LiveKit keys:** cloud.livekit.io → new project → Settings → API Keys → Create key (the secret is
      shown once). Put `LIVEKIT_URL` (wss://…), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `.env.local`
      at the repo root (git-ignored; never paste the secret anywhere else), restart `pnpm dev`. The game
      server log should say `"event":"voice","enabled":true`.
- [ ] **Restart `pnpm dev` once** so the local database gets the `voice_usage` table (migration 0003).
- [ ] **Voice on a laptop** (needs the keys): two browsers at `localhost:3000`, same room, Join voice on
      both, Mic on, talk. Host blocks the other's mic (silent + banner), then allows it. Leave voice.
- [ ] **Voice on phones** (Phase 3 check, Q4): Android Chrome and an iPhone. The mic needs https, so plain
      `http://<laptop-ip>` can only listen; use an https tunnel or the deployed site. On iPhone check
      "Tap to hear voice" and what happens after the tab goes to the background and back.
- [ ] **Server restart in a browser:** in a game between two browsers, Ctrl+C the game server and start
      it again within a minute. Both should show "Bringing your game back…" and return to the same
      board. With only one browser open, the room comes back to its lobby.
- [ ] **Online rooms on two phones** (or phone + laptop, different browsers): server dev + site
      `build` + `start` on port 3000, `/play` → create a room → open the link on the other. Join with 18+,
      lobby, Fast timer, a 5×5 game, results, rematch, refresh mid-game (same seat), Wi-Fi off 10 s
      (reconnecting bar, then back), Leave.
- [ ] **Rest of the redesign on a phone:** Settings (name, colour, every theme light/dark, Make your own,
      text size), 5×5 and 8×8 (two-tap call), results, History step-through, sounds and vibration.
- [ ] **Before launch:** answer Q1 (pricing), Q3 (name check), Q5 (server host); then create the Neon
      project (dev/production branches), set `DATABASE_URL`/`DATABASE_URL_DIRECT`, run `pnpm db:migrate`;
      after the deploy set the LiveKit webhook to `https://<game server>/livekit/webhook` and pick
      `VOICE_MONTHLY_CAP_MINUTES`.

## Next (code, in order)

1. **Phase 4: Google login + history.**
2. Gaps to close before launch: the daily job that clears `matches.actions` after 30 days; "no human
   for 3 turns → abandoned"; "unranked if auto-played" only counts the server's moves per seat; views
   aren't zod-checked (no `viewSchema` yet); no custom grid size in the room (presets only); unknown
   codes aren't rate-limited (Colyseus answers before `onAuth`): limit the matchmake route.
3. Not built in the room yet (answer `NOT_AVAILABLE_YET`): knocks (late joiners are spectators for now),
   new code, the host's "mute" (block mic covers it), rematch_ready.

## Phases

| Phase | Scope | State |
|---|---|---|
| 0 | Workspace, engine, protocol, UI tokens | done 2026-11-11 |
| 1 | Bingo rules + vs Computer (offline) | done 2026-11-11 (+ UI redesign) |
| 2 | Rooms (Colyseus) + online Bingo + crash recovery | code done 2026-11-13; owner phone checks pending |
| 3 | Voice (LiveKit) + host powers | code done 2026-11-13; owner voice checks pending (needs LiveKit keys) |
| 4 | Google login + history | not started |
| 5 | Word Guess | not started |
| 6 | Leaderboard | not started |
| 7 | Admin dashboard | not started |

## Run locally (any laptop, no .env needed)

1. `pnpm install`
2. Everything at once: `pnpm dev` (database on 5433, game server on 2567, site on 3000). Or one per
   terminal: `pnpm --filter @heartroom/db dev` (start this first), `pnpm --filter @heartroom/server dev`.
3. Site (port 3000, required: the server checks logins against `localhost:3000`):
   laptop only `pnpm --filter @heartroom/web dev`; for phones `pnpm --filter @heartroom/web build` then
   `pnpm --filter @heartroom/web start`, and open `http://<laptop-ip>:3000/play` on the same Wi-Fi
   (allow Node.js on Private networks in Windows Firewall).
4. A second player needs another browser or an incognito window (tabs of one browser are one guest).
   Local data lives in `.data/pglite` (git-ignored); stop the database and delete the folder to start
   fresh. The site and server need the database running (sign-in, saving games).

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
