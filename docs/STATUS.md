# Status

_Update this file at the end of every working session (any agent, any device)._

**Last updated:** 2026-11-15 (game hub, Word Guess polish, pre-launch gaps)
**Phase:** Phases 2–7 code done (owner checks pending, see the owner to-do) → next: Word Guess polish
and the gaps to close before launch.

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
- [x] **Phase 4: Google sign-in + online history** (2026-11-13): Better Auth Google provider when
      `GOOGLE_CLIENT_ID`/`_SECRET` are set (scopes `openid email`; Google name and photo never stored).
      A guest who signs in keeps their games: `lib/auth/link.ts` moves `match_players` + `voice_usage`
      (and the 18+ answer) to the account in one transaction before the guest row is deleted, also into
      an existing account. `match_players.nickname` (migration 0004). `GET /api/history` (own games, newest
      50, everyone's names; totals per game, shared wins as 1/k). Settings › Account (guest / Google,
      18+ box, Sign out) and History › Online. Checked with a production build against the local
      database; real Google sign-in not tried (needs the OAuth client). 343 tests.
- [x] **Phase 5: Word Guess** (2026-11-13): `packages/games/word-guess` (2 players; set a 4–7 letter
      everyday word, guess the other's at your own pace, guesses = length…10; two-pass feedback; fewer
      guesses wins, equal = draw; give up; 60 s setup clock with a server-picked word, away guessers get a
      guess after 60 s). Marks are stored at guess time so views never read the other secret; spectators
      see mark patterns only; `assertNoLeak` passes. Word lists: SCOWL via `wordlist-english`, loaded on
      the server only (`@heartroom/word-guess/server`). UI: `WordTile` (colour + shape + aria-label),
      `GameKeyboard` (on-screen + physical), `WordGuessGame`. Registry line + `gameById` (types erased for
      the room). Lobby game picker + per-game settings. Played in a production build against the real
      server with a scripted second player. 359 tests.
- [x] **Phase 6: Leaderboard** (2026-11-13): `/leaderboard` (nav: Ranks), rendered on the server.
      `lib/leaderboard/filters.ts` (game · 7 days / 30 days / all time · Bingo player band, from the URL
      with zod) and `query.ts` (ranked finished games only; total wins = sum of win_share, win rate,
      ≥10 games and ≥3 different signed-in opponents in the window; Google accounts only; names = last
      nickname; equal wins + rate share a rank; top 50 + your own row). Sticky bar: your rank, what you
      still need, or Sign in. Checked at 375 px against the local database with seeded players
      (deleted afterwards); your own row not seen in the browser (needs Google sign-in). 363 tests.

- [x] **Phase 7: Admin** (2026-11-14): `user.is_admin` + `admin_audit` (migration 0005), set only by
      `pnpm --filter @heartroom/db make-admin <email> [--remove]` (Google accounts). Game server
      `internal/rooms.ts`: `GET /internal/rooms` (per room: code, game, phase, seats, spectators, in voice,
      open for, idle, stuck, the **spectator** view only; voice minutes vs cap; uptime, reconnects,
      errors) and `POST /internal/rooms/:code/close` (audit row first; a game in play is recorded as
      abandoned; closed {reason: admin}). Rooms register in `internal/live-rooms.ts`. Every refusal is
      404 and `is_admin` is read from the database each time. Site: `/admin` (layout + page check
      `is_admin`, else 404), "Live rooms" (5 s poll via `/api/admin/rooms`, Inspect = the game drawn
      from the public view, Close with a second tap) and "Games" (games per game 7/30/all, abandoned
      rate, most wins per game, voice this month, room events in 24 h). New site env
      `GAME_SERVER_HTTP_URL` (empty locally = `http://localhost:2567`). Tested: real-server test (no
      secret word or user id in the answer, close → 4105 for everyone, audit, abandoned row), stats query
      on in-memory Postgres. Checked in a production build against the local database (a test guest
      flipped to admin, then back): guest → 404 for the page and both APIs; live room listed,
      Inspect drew the spectator board, Close (second tap) ended it; Games tab; 375 px fits.
      Real Google admin not tried. 372 tests.
- [x] **Game hub** (2026-11-15, owner feedback: the room-first flow and its game cards felt like
      confusing tabs): home lists the games as notebook-page cards (accent margin line, pitch, players,
      a drawn preview) plus "Have a code?"; `/games/<id>` has how to play, Play with friends (the room
      starts with that game) and Play alone (vs Computer, Bingo only). Lobby: the game is the heading,
      "Change game" opens the picker. One catalog (`features/games/catalog.ts`) and typed per-game
      records, so a new game can't half-exist. `/play` redirects home; nav says Games. Checked in the
      browser: home, game page, creating a Word Guess room lands with Word Guess picked (found and
      fixed: React's double effect in dev picked Bingo), Change game, 360 px fits. 375 tests.
- [x] **Word Guess polish** (2026-11-15): a sent guess's tiles turn over one by one (CSS keyframes
      `tile-flip` + `tile-face` in `tokens.css`: 320 ms, 60 ms stagger, shape then colour; reduced
      motion keeps only the colour snap; rows already there on load never flip). "What do the tiles
      mean?" under the keyboard (players) and under the boards (spectators). Refused moves now say
      why: the room passes the rule's `reason` (`errorMessage.reason`, `[a-z0-9_]`), and
      `features/room/refusals.ts` maps reason → code → protocol text per game ("Pick an everyday word
      for your secret. That one is too rare."). Checked in the browser with a scripted friend: refusal
      text, flip on the new row only, no flip after a refresh, legend doesn't move the keyboard. 377 tests.
- [x] **Pre-launch gaps** (2026-11-15), one commit each:
      **Matchmaking** (`matchmaking.ts`): only `create`/`joinById`/`reconnect` are exposed (Colyseus's
      `join`/`joinOrCreate` let anyone into any open room without a code); every call but reconnect
      takes a per-IP token, 30/min, so codes can't be guessed. **Client IP** (`client-ip.ts`): Colyseus
      trusted the client-written first `X-Forwarded-For`, so every per-IP limit was dodgeable; now
      `TRUST_PROXY` (required in production) picks the address the proxy appended.
      **Retention** (`persistence/retention.ts`): `matches.actions` emptied 30 days after a game, a
      minute after boot then daily. **Abandoned games**: 3 auto-played turns in a row with no player
      connected → recorded abandoned, room back to the lobby; a room that closes mid-game because
      everyone left now records the game as abandoned too (it recorded nothing). **Ranking**: "more
      than 2 auto-played turns" now counts turns (deadline keys), not moves (one Bingo setup timeout
      was 2). **Views**: `GameModule.viewSchema` (strict zod) for every game; `assertNoLeak` checks
      every view against it; the game message carries `gameId` and the site parses each view before
      drawing (`features/games/views.ts`), which also fixes drawing the last game's view as the next
      game. **Custom Bingo grid** in rooms (3×3–8×8, lines 1…2N+2). Checked with real-server tests and
      in the browser; the 3-turn rule has no automated test (real clocks are ≥15 s). 394 tests.

## Owner to-do (only the owner can do these; tick them here when done)

- [ ] **LiveKit keys:** cloud.livekit.io → new project → Settings → API Keys → Create key (the secret is
      shown once). Put `LIVEKIT_URL` (wss://…), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `.env.local`
      at the repo root (git-ignored; never paste the secret anywhere else), restart `pnpm dev`. The game
      server log should say `"event":"voice","enabled":true`.
- [ ] **Restart `pnpm dev` once** (Ctrl+C, then `pnpm dev`): the running site still has an old copy of
      the auth code, so History's "Online" part shows "Couldn't load" until then. (Migrations 0003 and
      0004 are already applied to the local database.)
- [ ] **Google OAuth client** (for "Sign in with Google"): console.cloud.google.com → new project →
      APIs & Services → OAuth consent screen (External, app name Heartroom, your email; scopes: only
      `openid` and `email`) → Credentials → Create credentials → OAuth client ID → Web application.
      Authorised JavaScript origin `http://localhost:3000`; authorised redirect URI
      `http://localhost:3000/api/auth/callback/google` (add the deployed site's origin and
      `https://<site>/api/auth/callback/google` later). Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
      in `.env.local` (never anywhere else) and restart `pnpm dev`. Google sign-in works only on
      `localhost` or https (not on `http://<laptop-ip>` from a phone).
- [ ] **Google sign-in check** (needs the client): play a room game as a guest, then Settings → tick 18+ →
      Sign in with Google → back on Settings it shows your email, and History › Online still has that
      game. Sign out, play another game as a new guest, sign in again: both games are in the account.
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
- [ ] **Word Guess on two devices:** pick Word Guess in the lobby, both choose a word, guess, give up once,
      rematch. Check the tiles are readable in light and dark themes and the keyboard fits a phone.
- [ ] **Leaderboard on a phone** (after Google sign-in and some ranked games): filters, your own row at
      the bottom, long names, light and dark.
- [ ] **New home on a phone:** home → tap a game → its page → Create room → the lobby already has
      that game. Try both games, "Change game" in the lobby, and "Have a code?" from home.
      In Word Guess: a made-up secret says why it was refused, guesses flip in, the tiles legend opens.
- [ ] **Rest of the redesign on a phone:** Settings (name, colour, every theme light/dark, Make your own,
      text size), 5×5 and 8×8 (two-tap call), results, History step-through, sounds and vibration.
- [ ] **Make yourself admin** (after Google sign-in works): stop nothing, run
      `pnpm --filter @heartroom/db make-admin <your Google email>` while `pnpm dev` is running (the
      local database must be up; restart `pnpm dev` once first so migration 0005 is applied). Open
      `localhost:3000/admin`: Live rooms (open a room in another browser, Inspect, Close it) and Games.
      A non-admin browser must get the 404 page.
- [ ] **Before launch:** answer Q1 (pricing), Q3 (name check), Q5 (server host); then create the Neon
      project (dev/production branches), set `DATABASE_URL`/`DATABASE_URL_DIRECT`, run `pnpm db:migrate`;
      after the deploy set the LiveKit webhook to `https://<game server>/livekit/webhook` and pick
      `VOICE_MONTHLY_CAP_MINUTES`. On the game server set `TRUST_PROXY=1` (Fly or Railway; it won't
      boot in production without it).

## Next (code, in order)

1. Admin extras the design names but this slice skipped: the 25-cell progress glyph per row, charts,
   a stuck-room alert (it's only a badge now).
2. Not built in the room yet (answer `NOT_AVAILABLE_YET`): knocks (late joiners are spectators for now),
   new code, the host's "mute" (block mic covers it), rematch_ready.

## Phases

| Phase | Scope | State |
|---|---|---|
| 0 | Workspace, engine, protocol, UI tokens | done 2026-11-11 |
| 1 | Bingo rules + vs Computer (offline) | done 2026-11-11 (+ UI redesign) |
| 2 | Rooms (Colyseus) + online Bingo + crash recovery | code done 2026-11-13; owner phone checks pending |
| 3 | Voice (LiveKit) + host powers | code done 2026-11-13; owner voice checks pending (needs LiveKit keys) |
| 4 | Google login + history | code done 2026-11-13; owner Google check pending |
| 5 | Word Guess | done 2026-11-13 (owner check on phones pending) |
| 6 | Leaderboard | done 2026-11-13 (seen with real ranked games pending) |
| 7 | Admin dashboard | code done 2026-11-14; owner check pending (needs Google sign-in + make-admin) |

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
- The local database (PGlite behind one socket) mixes up queries sent in parallel from one process
  ("bind message supplies N parameters"). Neon doesn't; keep server queries sequential, not
  `Promise.all`, or local pages fail at random.
- A `Date` inside a raw `sql` template works in tests (PGlite) but postgres.js refuses it: pass `toISOString()`.
- Phone testing uses plain `http://<laptop-ip>`, which is not a secure context: APIs like
  `crypto.randomUUID` don't exist there (this broke Start game on 2026-11-11). Test on the phone, not
  only on localhost.
- UI work: read `docs/design/ui-system.md` first; add themes only in `packages/ui/src/theme/themes.ts`
  (the contrast test guards them).
- Before a deploy: `pnpm db:migrate` with `DATABASE_URL_DIRECT` set (Neon direct URL). A schema change =
  edit `packages/db/src/schema.ts`, `pnpm db:generate`, review and commit the SQL.
- Bot strength tests use 2,000 fixed seeds; if a bot change fails them, the levels moved closer together.
