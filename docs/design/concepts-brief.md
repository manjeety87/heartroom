# Friends Game Platform (working name TBD): Bingo + Word Guess + more

* **Author:** manjeety87
* **Date:** 2026-11-10
* **Status:** v3. The Goldfish review is done (4 lenses), and its findings are under **Analysis** at the end.
  The author still has to decide the items in "Decisions for the author".
* **Companion docs:** [design direction](design-direction.md) · [research](research.md)

## Overview

A website where friends make a private room, share its code or link, and play
short turn-based games together while talking by voice. Rooms, voice,
spectators, accounts, history, leaderboards and the admin dashboard are built
**once** and shared by every game. Each game is a plug-in module that only
defines its own rules, its own board UI and its own stats.

Launch games:

1. **Bingo 1–25.** Five-line paper Bingo for 2–6 players, plus a vs Computer mode.
2. **Word Guess (rival's word).** One player secretly picks a word, and the
   other player guesses it with colour/position feedback after every guess.

More games are added later through the same module interface (candidates are
researched separately).

### Who it is for

Friend groups who already play these games on paper and want to play them
online, with the voice banter that makes the paper versions fun. The author and
the author's friends are the first users.

## Game 1: Bingo 1–25 (rules, decided)

* Each player fills a 5×5 grid with 1–25 (tap in order, or Shuffle). The setup
  timer fills any empty cells randomly.
* Players call a number on their turn. The server marks that number on every grid.
  12 possible lines; 5 lines = B‑I‑N‑G‑O.
* **Simultaneous Bingo → all of them win (shared win).** *Decided by author.*
* **First turn alternates between games** in a room: game 1 starts at seat 1, game 2 at
  seat 2, and so on. *Decided by author.*
* Turn timer (~15 s): when it runs out, the server makes a random call for that player.
* A grid is private to its owner until the game ends, then every grid is revealed.
* **vs Computer** with Easy, Medium and Hard levels. It runs in the browser using the shared rules code.

## Game 2: Word Guess (rules, proposed)

* **Setter** secretly chooses a word, and **Guesser** has to find it.
* Default number of guesses = word length (5-letter word → 5 guesses). The setter may
  set a custom number of guesses. *Decided by author.*
* After each guess, every letter box shows one of three states:
  * right letter, right place
  * letter is in the word but in a different place (author's example: secret `APPLE`,
    guess `MANGO` → only `A` is highlighted as "in word, wrong place", and the other letters show as absent)
  * letter not in the word
* Guessing the word within the limit = guesser wins. Otherwise the setter wins.
* **Open questions:** see Q3–Q6 below (dictionary, language, repeated letters, 2-player
  turn structure, 3+ players).
* Note: this feedback system is the classic "Mastermind with letters" idea (Jotto/Lingo family).
  We build our own look and name. We do not copy any specific commercial game's name or design.

## Room model (shared by every game)

| Role | Can play | Can speak / hear | Can see | Notes |
| --- | --- | --- | --- | --- |
| **Host** (created the room) | yes | yes | own board | Can **mute anyone** but **cannot unmute** anyone. Only a person can unmute themselves. Can kick (proposed). Can start the game and pick the game/settings. |
| **Player** | yes | yes | own board only | |
| **Spectator** (joined with code after seats are full, or chose to watch) | no | yes | public info only: whose turn, called numbers, line counts, guesses + colours | Must never receive hidden info (grids, the secret word), or a spectator could pass it to a player over voice. |

* Anyone with the code/link can join. *Decided by author.*
* If the host leaves, host passes to the longest-present player (proposed).

## Accounts, stats, leaderboard

* Guest = nickname only. Login (Google) is optional. A guest who signs up keeps their history.
* Per user, per game: games played, wins, **total wins and win rate**. *Decided by author.*
* Leaderboard **filters**: by game, by time (week / month / all-time), and by mode/player count
  (proposed). *Filters decided by author; exact filter list proposed.*
* Leaderboards count only fair games: ≥2 signed-in humans, no bot, game finished.
* Win rate needs a minimum number of games (e.g. 10). Otherwise one win from one game
  ranks first at 100%.

## Admin dashboard (author only)

* **Live:** rooms right now (game, players, spectators, voice on/off, age, idle/active), and
  the ability to close a room.
* **History:** rooms created per day, games played per game type, average game length,
  completion vs abandoned.
* **Users:** wins per user per game, signups, guest → account conversion.
* Access: admin role on the account. A separate route (`/admin`), checked on the server.

## Proposed architecture

```
Browser (Next.js)
  ├─ HTTPS: pages, login, profile, leaderboard, /admin
  ├─ WebSocket: room + game events
  └─ WebRTC audio: voice (LiveKit)

Realtime game server (Node + TS, long-running)
  ├─ Room service (generic): seats, roles, host powers, timers, reconnect, spectators
  ├─ Game modules: bingo/, word-guess/, ... each implements GameModule
  ├─ Redis: live room state, pub/sub across instances, live-room index for admin
  └─ Postgres: users, matches, match_players, per-game stats, admin queries
```

### The GameModule contract (pseudocode, not final)

```
GameModule<Config, State, Action, PublicView, PrivateView> {
  id, name, minPlayers, maxPlayers, supportsSpectators, supportsBot
  configSchema            // zod: e.g. Word Guess custom guess count
  actionSchema            // zod: every client message validated
  setup(config, seats, rng) -> State
  legalActions / validate(state, seat, action) -> ok | error
  apply(state, seat, action, now) -> State      // pure; no I/O
  onTimeout(state, seat, rng) -> State          // what happens when a turn timer runs out
  publicView(state) -> PublicView               // spectators and everyone get this
  privateView(state, seat) -> PrivateView       // only this seat gets it
  result(state) -> null | { winners[], ranking[], stats }
}
```

The room service never knows game rules. A new game = one new module plus its UI and stats
definition. Pure `apply` functions make every game fully unit-testable and let the
server replay a match from its action log.

### Key choices still open (the author picks)

* **Realtime layer:** (a) hand-built Socket.IO + Redis, (b) **Colyseus** (open-source Node
  framework built for multiplayer game rooms, with reconnection, rooms, presence and a monitor
  panel; it has an official agent skill), or (c) Cloudflare Durable Objects / PartyKit (one
  small server per room).
* **Voice:** LiveKit Cloud (relay included, free tier has a monthly minutes limit), or
  self-hosted LiveKit, or peer-to-peer with our own TURN server.
* **Repo shape:** monorepo (Turborepo + pnpm): `apps/web`, `apps/server`, `packages/games/*`,
  `packages/ui`, `packages/db`.

## Goals vs. Non-Goals

* **In-Scope (v1):** platform shell + rooms + spectators + voice with host mute; Bingo
  (multiplayer + vs Computer); Word Guess (2 players); guest + Google login; history; leaderboard
  with filters; admin dashboard.
* **Non-Goals (v1):** public matchmaking with strangers; text chat (could be added later); native
  apps; payments, coins or ads; more than 2 games at launch; user-made games.

## Alternatives Weighed

* **Firebase as game server.** Rejected by author: game logic would run in the browser, and
  hidden boards/secret words would be readable.
* **Separate codebase per game.** Rejected by author: the author wants "overall code same,
  only game and stats change".
* **Serverless WebSockets on Vercel.** Rejected: functions cannot hold a game-length socket.
* **Peer-to-peer voice without a relay.** Proposed rejection: some networks block direct
  connections, and 6 players + spectators means too many upload streams per phone.

## Analysis (Goldfish review, 2026-11-10)

Four fresh-context reviewers read v2 of this brief: (1) YAGNI + tech debt, (2) cost + operations,
(3) player UX + trust & safety, (4) security + inventive catalyst. Findings merged and de-duplicated:

### What the reviewers agreed on

1. **Do not hand-build the room layer.** Colyseus (actively maintained: 0.17 added auto-reconnect and
   end-to-end types, 0.18 added `@colyseus/admin` and `@colyseus/database`) already has rooms, seats,
   reconnection and a monitor panel. boardgame.io is in maintenance mode, so we should not use it.
   Start with **one server process and no Redis**. Add Redis only when a second instance is needed.
   *Watch-out:* Colyseus syncs state through its own Schema system, which clashes with our "pure rules
   + views" idea. Pick one approach: keep plain state inside the room and send only computed views as
   messages.
2. **Hidden info leaks are the #1 risk.** `view(state, viewer)` must be the *only* way state leaves
   the server (no "initial full sync", no raw state in errors, logs, admin live view or pub/sub). Each
   game gets a contract test that checks spectator and opponent payloads never contain a grid or a
   secret word. The Bingo end reveal happens inside the view once a result exists. The Word Guess
   dictionary check runs on the server.
3. **Concurrency rules are missing.** Each room needs one serialized action queue. Every action carries
   `turnSeq` and stale ones are rejected. Timers go through the same queue, so a late timer does
   nothing. One active socket per seat, and the newest one takes over.
4. **Replay needs determinism.** One crypto-generated seed per match (never sent to clients before the
   end). Each timeout is logged as a normal action (`{type:"auto", by:"server"}`). Store `moduleVersion`.
   Add a test that replays the log and checks the result matches.
5. **Revised GameModule contract** (so later games such as hidden-role games fit):
   * `view(state, viewer)` where viewer = seat | role | spectator, instead of public/private views.
   * Deadlines are stored as data in state, and the engine calls `tick(state, now)` instead of
     `onTimeout(seat)`.
   * An opt-in "ephemeral" channel for things that are not moves (reactions, and later drawing strokes).
   * Real-time games are out of scope. Freeze the contract only after game #2 is built.
6. **Stats schema:** `matches` + `match_players(result, placement)` + a JSON column for game details.
   Leaderboards are queries, not a table per game, so a new game never needs a migration.

### Host powers are not strong enough as written (UX + security both flagged)

* "Mute but can't unmute" alone does nothing: the troll unmutes themselves. Add:
  * **Block mic:** the host stops someone from speaking until the host lifts it. This is done on the
    server with LiveKit `UpdateParticipant canPublish:false`. A plain track mute is not enough.
  * **Kick + ban** for the life of the room (keyed by guest/user ID, so the same code cannot be reused
    to rejoin).
  * **Lock room** and **New code**.
* Enforce host powers on the server. The browser never gets a LiveKit `roomAdmin` token. LiveKit tokens
  are bound to the internal room ID and a server-assigned identity (not the nickname), have about a
  10-minute TTL, and set `canPublishData:false` so voice data cannot become a cheating side channel.
* **Inventive fix for open rooms vs safety:** the code works freely until the game starts. After that,
  a newcomer "knocks" and the host accepts with one tap.

### Voice cost is the biggest number in the whole project

| Games/day | Voice participant-min/month | LiveKit Cloud | Everything else |
|---|---|---|---|
| 50 | 25k–38k | free tier passed → Ship plan ≈ $50 | ≈ $5 |
| 1,000 | 0.5M–0.75M | ≈ $230–350 | ≈ $30–80 |
| 20,000 | 10M–15M | ≈ $5k–7.5k | ≈ $500 |

The LiveKit free plan includes **5,000 participant-minutes per month, which is about 7 voice games a
day**. Our own friend group would use that up in the first week. Spectators and idle listeners are
billed the same as players. To keep it in check:
* Voice connects only when someone taps "Join voice", and disconnects after 2–3 minutes idle.
* Spectators opt in to voice.
* Track a monthly minutes cap in admin, and when the cap is reached new rooms run with "voice off"
  instead of a surprise bill.
* Self-hosted LiveKit costs about $5–10/month, but we would have to run it ourselves.

(Pricing came from third-party pages in some cases. Check the official LiveKit, Fly, Upstash and Neon
pages before deciding.)

### Operations

* Render's free tier sleeps, so it is not suitable. Fly has no free allowance for new accounts (about $2–5/month).
  Railway Hobby is $5/month. Vercel Hobby is non-commercial only.
* **Deploys must not kill games.** On SIGTERM the server stops taking new rooms and lets live games
  finish (up to about 10 minutes). It then snapshots state and exits, and clients resume with a token.
* "My game froze": every message carries `seq`. A client that sees a gap asks for a resync. The UI
  shows a copyable room ID. Admin gets an "inspect room" page (public view only) and a stuck-room alert.
* Log structured events from day one: room/game lifecycle, every action and rejection, timer
  auto-moves, socket reconnects, voice join/leave (from LiveKit webhooks), host actions, and errors
  (Sentry free tier).
* Store action logs in Redis/disk with a TTL. Postgres stores only compact results, so the Neon free
  tier (0.5 GB) does not fill up.

### Player UX

* **Bingo with 6:** each player calls only 2–3 times. Use a 10 s timer (configurable), a 30 s setup,
  a "1 away" alert everyone can see, and a "you needed N" note at the end. Skip empty seats when the
  first turn rotates.
* **Timer modes (inventive fix):** Fast (10–15 s), Chill (no timer, and any player can press "Nudge"
  to start 30 s), and Away-only (the timer runs only when a player's tab is hidden or disconnected).
* **Word Guess:** use the two-pass repeated-letter rule (secret APPLE, guess PAPAL → P wrong place,
  A wrong place, P right place, A absent, L wrong place). Secret words come from a common-words list,
  guesses from a valid-words list. Guesses must be at least the word length and at most about 10.
  Both players set a word and both guess (Jotto style). The setter watches guesses live. Feedback uses
  colour plus shape (colour-blind safe).
* **vs Computer:** the bot receives only the public view and its own seat's view. A test checks it
  plays the same when your grid is randomised. Bot games never count towards stats (the server ignores them).
* **Voice on phones:** an explicit "Join voice" tap (iOS audio playback needs a user gesture). Expect
  the mic to drop when the tab goes to the background. Ask for headphones when two players sit in the
  same room (echo). Offer a "voice off" toggle (≈80–100 MB/hour on mobile data).
* **Codes:** 6 characters from a 31-letter set (≈887M codes), join rate limit about 10/min per IP,
  an unguessable token inside share links, and codes expire when the room closes.

### Leaderboard fairness

Every ranked game is played between friends, so results can be arranged (alt accounts, hints given over
voice, an easy Word Guess word). Proposals:
* Count a shared win as 1/k.
* Require several distinct opponents and a minimum number of games (lichess uses 30 plus recent activity).
* Cap ranked games per opponent pair per day.
* Word Guess is ranked only with server-bounded settings.
* Friends/group leaderboard by default, with global as a filter.

### Legal (India, DPDP Act + Rules notified Nov 2025)

Under DPDP anyone under 18 is a child, which needs verifiable parental consent and no behavioural
tracking. Secondary sources say these obligations apply from about May 2027 (not confirmed in the
official text). A per-user win history is arguably tracking. The decision is: **18+ only** (declared
at join), or a **no-profile mode for minors** (no stats). In either case: voice is never recorded,
store only the Google `sub` and a nickname (no email or photo unless needed), filter nicknames
(English + Hinglish), and the admin dashboard shows totals only.

## Proposed staging (keeps every feature the author asked for, in order)

| Phase | Ships | Why this order |
|---|---|---|
| 0 | Monorepo (pnpm workspaces), rules packages + tests, design tokens | Everything else depends on these |
| 1 | Bingo vs Computer (browser only) | Playable with no server; tests rules and UI |
| 2 | Rooms (Colyseus): create/join/rejoin, Bingo online, spectators, host kick/lock | The core of the platform |
| 3 | Voice: join voice, mute, host block-mic, minutes metering + cap | The most expensive part, so it goes in once rooms are stable |
| 4 | Guest session + Google login, history | Needs the 18+ decision first |
| 5 | Word Guess (both set, both guess) | Proves the GameModule contract with a second game |
| 6 | Leaderboard with filters + fairness rules | Needs real match data |
| 7 | Admin dashboard (live rooms, inspect, close, analytics, quotas) | Live rooms come early from the Colyseus monitor; the full dashboard comes here |
| 8+ | Next games: Raja-Mantri-Chor-Sipahi, Word imposter, Name-Place-Animal-Thing… | See research.md |

## Decisions (2026-11-10: author accepted the recommended defaults)

1. **Name:** **Heartroom** (chosen by the author: "Mann" = heart, plus "room"; no game app found under this
   name in a quick search). Before launch, do a trademark + domain check;
   the name can still change.
2. **Realtime layer:** **Colyseus**, one process, no Redis until a second instance is needed. Game
   state stays as plain objects inside the room, and only `view(state, viewer)` results are sent as
   messages (no Colyseus Schema sync of game state).
3. **Voice:** **LiveKit Cloud free tier** to start. Voice minutes are metered from day one, with a hard
   monthly cap; above the cap, new rooms run with voice off. When the cap is hit regularly, move to
   self-hosted LiveKit or the Ship plan.
4. **Age:** **18+ only**, declared when joining or signing up. A no-profile minors mode may come later.
5. **Host powers:** mute (the person unmutes themselves), **block mic** (server-enforced until the host
   lifts it), **kick + ban** for the life of the room, **lock room**, **new code**. After the game starts,
   newcomers knock and the host accepts.
6. **Spectators:** join with mic off and voice *not connected*. Listening and talking are both opt-in,
   and the host can block a spectator's mic.
7. **Leaderboard:** history records a shared win as a win. **Ranking counts it as 1/k.** One global
   leaderboard with filters (game, time, mode). To appear, a player needs ≥10 ranked games against ≥3
   different opponents. Ranked games per opponent pair are capped at 10/day. A friends filter comes
   later with a friends system.
8. **Word Guess:** both players set a word and both guess (Jotto style). English only. Secret words come
   from the common list (SCOWL ≤50), guesses from the valid list (ENABLE). Word length 4–7. Guess limit
   from word length up to 10 (default = word length). Feedback uses the two-pass repeated-letter rule.
   Fewer guesses wins, ties go to the faster player, then a draw.
9. **Bingo timer:** default **Fast 15 s** turns and 30 s setup. The room can pick **Chill** (no timer
   plus Nudge) or **Away-only**.

## Open questions for the author (v2, mostly answered by the analysis above)

1. Platform name (shortlist coming with the research).
2. Can spectators **talk**, or only listen by default with the host allowing them to talk? (Author said
   they can listen, talk and watch. Proposed default: spectators join muted.)
3. Word Guess dictionary: must the secret word be a real English word? What about Hindi/Hinglish words?
   (If any word is allowed, a setter can pick "XQZJK" and the game is unwinnable.)
4. Word Guess guesses: must each guess be a real word, or any letters?
5. Word Guess with 2 players: one round each (both set and both guess, and the faster/fewer-guess
   player wins the match), or a single one-sided round?
6. Word Guess with 3+ players: one setter and everyone else races, or not supported in v1?
7. Word length range: 4–7 letters?

## Key Decisions & Staging for Next Steps

* Decided: platform with pluggable games; Bingo rules (shared win, alternating first turn);
  Word Guess feedback model + custom guess count; spectators via code; host mute-only power;
  total wins + win rate + filters; admin dashboard.
* Next: games research + design system → Goldfish review → author answers → `/egm-draft`.
* Build order (proposed vertical slices): rules packages + tests → vs Computer Bingo (no
  server) → rooms + Bingo online → voice + host mute + spectators → accounts + history →
  Word Guess → leaderboard → admin.
