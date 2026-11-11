# Heartroom: a private game room for friends, with voice

*   **Author:** manjeety87
*   **Status:** Draft. Sections written so far: Overview, Problem, Goals, Non-Goals, Open Questions, CUJs,
    Technical Plan, Alternatives, Non-Functional Requirements, Detailed Implementation. All sections are
    drafted. Next: egm-review.
*   **Date:** 2026-11-10
*   **Source:** [concepts-brief.md](concepts-brief.md) v3 (accepted defaults), [design direction](design-direction.md), [research](research.md)

--------------------------------------------------------------------------------

## Overview

Heartroom is a website where a group of friends opens a private room,
shares a short code or link, and plays short paper-and-pencil style games together while talking by
voice. The launch games are **Bingo 1–25**, the five-line Bingo played on the back page of a school
notebook, and **Word Guess**, where each player sets a secret word for the other and guesses with
letter-position feedback.

Rooms, voice, spectators, accounts, match history, leaderboards and the admin dashboard are built
once. Each game is a separate module that supplies only its rules, its board UI and its stats, so new
games (Raja-Mantri-Chor-Sipahi, Word Imposter, Name-Place-Animal-Thing…) can be added without
changing the platform.

## The Problem

Friend groups who grew up playing these games on paper have no good way to play them together when
they are not in the same place:

*   **No site has this combination.** Existing 1–25 Bingo rooms (e.g. Skich) are 2-player only, with no
    voice, history or computer opponent. Most online Bingo is the 75/90-ball caller format, which is a
    different game.
*   **Voice is what makes these games fun, and it usually sits in another app.** Friends play in one
    tab and talk on a WhatsApp or Discord call in another. Ludo King shows the demand: reviewers say
    their friends moved to a rival app only because it had voice. It also shows the failure mode, where
    voice is locked behind paid "talk time" and drops when you switch apps.
*   **Signing up kills the moment.** A link shared in a group chat must work in seconds, with no
    account and no install (the skribbl.io / Gartic Phone pattern).
*   **Paper games are easy to cheat, and online they are easy to break.** Someone marks a number they
    did not get, peeks at a grid, or stalls. Online, the same problems become hidden grids leaking to
    other browsers, out-of-turn moves and frozen games when one person's network drops.

**Proposed solution:** a server that acts as referee. It holds every hidden board and secret word,
accepts moves only when it is that player's turn, and sends each person only what they are allowed
to see. Around that sit a room system (code/link join, seats, spectators, rejoin, host controls),
room voice built on LiveKit, and optional accounts that keep history and feed the leaderboards.

## Goals

The first release succeeds when all of these hold:

*   **G1: Join fast.** From a shared link, a first-time guest is in the room in **≤3 actions** (accept
    or type a nickname, tick 18+, tap Join), and a returning guest in **1 tap**, with no account and no install, on a mid-range Android phone in Chrome and on iPhone Safari.
*   **G2: Bingo 1–25 for 2–6 players**, with the agreed rules: shared win, first turn alternating
    between games, 15 s Fast timer by default (Chill and Away-only selectable), 30 s setup, end-of-game
    reveal of every grid, and one-tap rematch in the same room. **Custom grids:** the host can pick
    any size from 3×3 to 8×8 (numbers 1…N²) and how many lines are needed to win. Classic 5×5 / 5 lines
    is the default and the only ranked setting.
*   **G3: Bingo vs Computer** (Easy / Medium / Hard), playable with no server connection. The bot
    sees only what a human opponent would see.
*   **G4: Word Guess for 2 players.** Both players set a word and both guess. English only, words of
    4–7 letters, secret words from a common-words list, guesses checked against a valid-words list,
    and colour-blind-safe feedback using the two-pass repeated-letter rule.
*   **G5: No hidden information ever reaches the wrong browser.** No other player's grid and no secret
    word before the reveal. Every game has an automated test that proves this.
*   **G6: Games survive network trouble.** A refresh or a network drop of up to 60 s returns the player
    to the same seat with the correct board. A player who stalls or drops cannot freeze the game (the
    server auto-plays on timeout). A server deploy does not end live games.
*   **G7: Room voice that costs nothing unless it is used.** Voice connects only after the player taps
    "Join voice". Everyone can mute themselves, and voice disconnects when idle. Voice minutes are
    metered, and when a monthly cap is reached new rooms run with voice off. The game never depends on
    voice working.
*   **G8: The host keeps the room safe.** Mute, server-enforced block-mic, kick + ban for the life of
    the room, lock room, new code, and knock-to-join once a game has started. Spectators join with
    voice disconnected and opt in to listening or talking.
*   **G9: Optional accounts.** Google sign-in. Guests keep their history when they sign up. Users declare
    they are 18+. We store the Google ID, the Google email (Better Auth requires it for linking) and
    the nickname. No photo, no real name, no IP or user-agent.
*   **G10: Fair leaderboards.** Total wins and win rate per game, filtered by game, time and mode.
    Bot games never count. A shared win counts as 1/k for ranking. Players appear only after ≥10
    ranked games against ≥3 different opponents.
*   **G11: An admin dashboard for the author.** Live rooms (inspect the public view, close a room),
    games played per game, wins per user per game, abandoned rate, and voice minutes against the cap.
*   **G12: Adding a game does not touch the platform.** Game #2 (Word Guess) ships as a new module plus
    UI, with no change to the room, voice, stats or admin code beyond registering the module.

## Non-Goals

*   **Public matchmaking with strangers.** Rooms are private, by code or link only.
*   **Text chat.** Voice and (later) emoji reactions only.
*   **Native Android/iOS apps.** The website must work well in mobile browsers first.
*   **Payments, coins, ads or real-money play.**
*   **Users under 18.** No child-consent flow in this release.
*   **Hindi/Hinglish word lists.** Romanised spelling varies too much for letter-position feedback.
*   **Real-time (twitch) games and draw-and-guess.** The module contract covers turn- and round-based
    games only.
*   **More than one server instance, and Redis.** These are added only when one instance is no longer
    enough.
*   **Voice recording.** Voice is never recorded or stored.
*   **A friends system and a friends-only leaderboard.** These come later.

## Open Questions

*   **Q1: Pricing to confirm.** Verify on the official pages: LiveKit free-tier minutes and Ship-plan
    concurrency limits, the Fly.io/Railway minimum cost, and the Neon free storage. Some figures in the
    review came from third-party pages.
*   **Q2: Colyseus version and Schema use.** Confirm that the latest Colyseus release supports keeping
    game state as plain objects and sending per-client messages only, without fighting its Schema sync.
    Spike this before the room phase.
*   **Q3: Brand check.** Run a trademark and domain search for "Heartroom" before any public launch. A quick search found no game app with this
    name. Also check that the name does not read as a dating app in the landing copy.
*   **Q4: iOS Safari voice.** Check on a real iPhone how voice behaves after the tab goes to the
    background and comes back (auto re-join or a "Tap to reconnect voice" button).
*   **Q5: Where the game server runs.** Fly.io or Railway (both about $2–5/month). The choice depends on
    India-region latency and price. (Drain support no longer matters: deploys restart immediately
    and players resume from checkpoints.)

## Critical User Journeys (CUJs)

### CUJ 1: Create a room and invite friends

*   **Given:** Riya opens the site on her phone. She has no account.
*   **When:** She taps **Create Room**, accepts the suggested nickname, picks Bingo, and taps **Invite**,
    which opens the share sheet with WhatsApp first.
*   **Then:** A room with a 6-character code (`KHJ 427`) and a share link exists. Riya is host in seat 1.
    The link opens the room preview for anyone who taps it.

### CUJ 2: Join from a link in two taps

*   **Given:** Kabir taps Riya's link in a WhatsApp group. The room has 3 of 6 seats taken.
*   **When:** He keeps or edits the suggested nickname, ticks "I'm 18 or older" (first visit only)
    and taps **Join Room**.
*   **Then:** He sits in seat 4 with his mic off, sees who is there, and nobody needed an account. If
    the seats had been full, the button would have read **Join as Spectator**.

### CUJ 3: Play a game of Bingo online

*   **Given:** 4 players are seated. The host taps **Start Game** in Fast mode.
*   **When:** Each player fills their grid (tap in order or Shuffle) within 30 s. Then the players take
    turns calling numbers, and one player's call completes their 5th line.
*   **Then:** Every grid shows each called number within about 300 ms. Opponents see only line counts.
    The winner's B‑I‑N‑G‑O completes. All grids are revealed with each loser's "you needed N" note.
    The match is recorded, and **Rematch** starts the next game with the next seat going first.

### CUJ 4: A shared win

*   **Given:** Kabir and Aarav each have 4 lines, and one number would complete a 5th line for both.
*   **When:** Any player calls that number.
*   **Then:** Both are shown as winners ("Kabir & Aarav — BINGO together"). History records a win for
    each, and the ranking gives each of them 1/2.

### CUJ 5: Disconnect and rejoin mid-game

*   **Given:** It is Aarav's turn and his phone loses network.
*   **When:** His 15 s timer runs out. He reconnects 40 s later.
*   **Then:** The server made a random call for him at the timeout, and the game kept going. On
    reconnect he is back in his seat with his correct grid, and nobody else's grid was ever sent to him.

### CUJ 6: Voice and host safety

*   **Given:** A stranger got the code, joined as a spectator, enabled voice and is shouting.
*   **When:** The host opens the stranger's seat menu and taps **Block Mic**, then **Kick**, then **Lock Room**.
*   **Then:** The stranger cannot publish audio (enforced by LiveKit permissions, not only the UI), is
    removed, cannot rejoin this room with the same identity, and new joins are refused until the host
    unlocks the room.

### CUJ 7: Play Bingo vs Computer offline

*   **Given:** Neha is on a train with no network and opens the site from a cached visit.
*   **When:** She picks Bingo vs Computer (Medium).
*   **Then:** The game plays fully in the browser. The bot never reads her grid. The result does not
    count towards any stats or leaderboard.

### CUJ 8: A round of Word Guess

*   **Given:** Riya and Kabir are in a room. The host picks Word Guess with 5-letter words and the
    default guesses (5).
*   **When:** Each player enters a secret word, which the server checks against the common-words list.
    Each then guesses the other's word, and every guess is checked against the valid-words list.
*   **Then:** Each guess shows right-place / wrong-place / absent with both colour and shape. For
    secret `APPLE` and guess `PAPAL` the result is P wrong place, A wrong place, P right place,
    A absent, L wrong place. Each setter watches the other's guesses live. The player who solved in
    fewer guesses wins.

### CUJ 9: Guest becomes an account

*   **Given:** Kabir has played 6 games as a guest on this browser.
*   **When:** He taps "Sign in with Google to keep your history" and confirms he is 18+.
*   **Then:** His 6 games now belong to his account. Only his Google ID and nickname are stored.

### CUJ 10: The admin checks the platform

*   **Given:** The author is signed in with the admin role.
*   **When:** They open `/admin`.
*   **Then:** They see live rooms (game, players, spectators, voice, idle time) and can inspect a room's
    public view or close it with confirmation. They also see games per game type, wins per user per
    game, the abandoned rate, and voice minutes against the monthly cap. Non-admins get a 404 from
    both the page and its data APIs.

## Technical Plan (Architecture)

### System overview

```text
             ┌──────────────────────── Browser (phone / laptop) ────────────────────────┐
             │ Next.js app (React)                                                       │
             │  ├─ pages: landing, /r/[code], room, profile, leaderboard, /admin          │
             │  ├─ game UIs: packages/games/*/ui   (render views, send intents)          │
             │  ├─ vs Computer: runs packages/games/bingo/rules + bot locally (no server)│
             │  └─ voice: livekit-client hooks, our own UI                               │
             └──────┬──────────────────────┬───────────────────────────┬────────────────┘
          HTTPS     │           WebSocket   │                 WebRTC    │ (audio only)
                    ▼                       ▼                           ▼
   ┌──────────────────────┐   ┌──────────────────────────────┐   ┌────────────────┐
   │ Next.js server       │   │ Game server (Node, Colyseus) │   │ LiveKit Cloud  │
   │ (Vercel)             │   │ (Fly.io / Railway, 1 process)│   │ (voice relay)  │
   │  ├─ Better Auth      │   │  ├─ GameRoom (one per room)  │◀──┤ webhooks:      │
   │  │  (anon + Google,  │   │  │   action queue, timers,   │   │ join/leave,    │
   │  │   issues JWT)     │   │  │   seats, host powers      │──▶│ minutes        │
   │  ├─ history, board,  │   │  ├─ game module registry     │   │ server API:    │
   │  │  admin data APIs  │   │  ├─ VoiceAdapter (tokens,    │   │ tokens, perms, │
   │  └─ reads Postgres   │   │  │   block-mic, metering)    │   │ remove         │
   └─────────┬────────────┘   │  └─ writes match results     │   └────────────────┘
             │                └──────────────┬───────────────┘
             ▼                               ▼
        ┌────────────────────────── Postgres (Neon) ──────────────────────────┐
        │ users/sessions (Better Auth) · matches · match_players · voice_usage │
        │ admin_audit · room_events                                            │
        └──────────────────────────────────────────────────────────────────────┘
```

* **Two deployables.** The Next.js app on Vercel handles pages, auth and every read-only API
  (history, leaderboard, admin data). The game server on Fly.io or Railway holds every live room.
  Both use the same Postgres database.
* **One game-server process** in this release. No Redis. A live room lives in that process's memory.
  Each finished match is written to Postgres straight away.

### Repository layout (pnpm workspaces)

```text
heartroom/
  apps/web/            Next.js (App Router): pages, Better Auth, read APIs, admin
  apps/server/         Colyseus game server: GameRoom, VoiceAdapter, persistence
  packages/engine/     GameModule contract, Viewer type, seeded RNG, match replay
  packages/games/bingo/       rules.ts, bot.ts, module.ts, ui/, rules.test.ts
  packages/games/word-guess/  rules.ts, feedback.ts, words/, module.ts, ui/, tests
  packages/db/         Drizzle schema + migrations (shared by web and server)
  packages/ui/         design tokens (Tailwind v4 @theme) + shared components (InkRing…)
  packages/protocol/   zod schemas for every client↔server message
```

`packages/engine` and `packages/games/*/rules.ts` are plain TypeScript with no Node or browser
APIs, so the server, the browser (vs Computer) and the tests all run the same code.

### The GameModule contract

```ts
type Viewer = { kind: "seat"; seat: number } | { kind: "spectator" };

interface GameModule<Config, State, Action, View> {
  id: "bingo" | "word-guess" | string;
  version: number;                         // bumped on any rule change; stored per match
  players: { min: number; max: number };
  configSchema: ZodType<Config>;           // e.g. timer mode, word length, guess limit
  actionSchema: ZodType<Action>;           // every intent from a client is parsed with this

  setup(config: Config, seats: number, rng: Rng): State;
  validate(state: State, seat: number, action: Action): Ok | RuleError;
  apply(state: State, seat: number, action: Action): State;   // pure, no clock, no I/O
  nextDeadline(state: State): { seat: number; at: number } | null; // when the clock must act
  autoAction(state: State, seat: number, rng: Rng): Action;   // what the server plays on timeout
  view(state: State, viewer: Viewer): View;                   // the ONLY way state leaves the room
  result(state: State): null | { winners: number[]; placements: number[]; details: Json };
  perturbHidden(state: State, viewer: Viewer, rng: Rng): State; // test-only: changes everything this viewer must not know
}
```

The design rules behind it:

1. **`view` is the only exit.** The room never sends `State`. Every outgoing message goes through
   `view(state, viewer)`: in full on join and resync, and as a patch afterwards (see Sync below).
   The Bingo end reveal and the Word Guess secret reveal happen *inside* `view` once
   `result(state) !== null`.
2. **The clock lives in the room, not in the rules.** A module only says when the next deadline is
   (`nextDeadline`) and what to play when it passes (`autoAction`). The room turns a timeout into a
   normal logged action, `{ by: "server", action }`. That keeps `apply` pure and makes every match
   replayable from `(moduleVersion, config, seed, actions[])`.
3. **Randomness comes only from `Rng`.** `Rng` is a seeded PRNG (e.g. xoshiro128\*\*). The seed is
   32 bytes from `crypto.getRandomValues`, made once per match, never sent to clients before the
   match ends, and stored with the match.
4. **The contract is frozen only after Word Guess ships** (G12). Changes before then are expected.

### GameRoom: one Colyseus room per Heartroom room

```text
client intent ──zod parse──▶ enqueue ──▶ [single queue per room] ──▶ handle(intent)
timer fires  ─────────────▶ enqueue ──▶            │                    │
host command ─────────────▶ enqueue ──▶            │                    ├─ check role / seat / turnSeq
                                                   ▼                    ├─ module.validate → apply
                                              one at a time             ├─ append to action log
                                                                        ├─ turnSeq++ , reschedule timer
                                                                        └─ send view() to each client
```

* **One queue per room.** Every intent, timer callback and host command is handled one at a time,
  so two calls that arrive together, or a timer that fires while a call is in flight, cannot both
  apply. Each game intent carries `turnSeq`. The room rejects an intent whose `turnSeq` is stale,
  and a timer that wakes up for an old `turnSeq` does nothing.
* **Room state** (outside the game): `code`, `linkToken`, `hostId`, `locked`, `seats[]` (userId,
  nickname, connected, voice state), `spectators[]`, `bans` (set of user IDs), `knocks[]`, `phase`
  (lobby | setup | playing | results), `current` (moduleId, config, state, seed, actions, turnSeq),
  and `startSeatRotation`.
* **Identity.** Every client joins with a JWT from Better Auth, which also covers anonymous guests.
  The room ties a seat to `userId`. A second connection with the same `userId` takes over the seat,
  and the old socket is closed. Nicknames are display only.
* **Reconnect.** Colyseus `allowReconnection(client, 60)`. On reconnect the client gets a full
  `view` for its viewer.
* **Joining.** Joining by code is open in the lobby. Once a game has started, a newcomer goes to
  `knocks[]` and the host accepts them as a spectator or into a free seat. `locked` refuses every
  join, and anyone in `bans` is refused.
* **Codes.** 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 characters, 32⁶ ≈ 1.07B codes). The
  share link carries a separate 128-bit `linkToken`. Typing the code into the join field is rate-limited
  to 10 attempts per minute per IP. A code is freed when its room closes.
* **First turn rotation.** `startSeatRotation` moves to the next *occupied* seat after every game.

### Sync model (decision on how this works with Colyseus)

Game state is **not** put in a Colyseus `Schema`. The room keeps plain objects and sends two kinds
of messages:

* `room` (seats, spectators, phase, host, voice states): small and public, sent in full on change.
* `game` (`{ seq, view }` per viewer): after each action, the room computes `view(state, viewer)`
  for every connected viewer and sends it with the action's `seq`. A client that sees a gap
  (`seq` ≠ last + 1) sends `resync` and gets the full view. Views are small (a 5×5 grid, 25 called
  numbers, at most 10 guess rows), so sending the whole view each time is cheaper than writing diffs.

Open Question Q2 checks this approach against the current Colyseus release in a one-day spike.

### Voice (VoiceAdapter in the game server)

* The browser asks the game server for a voice token by tapping "Join voice". The server mints a
  LiveKit token with: `room = internal room ID`, `identity = userId`, `ttl = 60 s` (the TTL only
  limits the *first* connection, and LiveKit refreshes the token of a connected participant itself,
  so we do no renewal of our own), `canSubscribe = true`, `canPublish = true` only if the person is allowed to speak,
  `canPublishSources = ["microphone"]`, and `canPublishData = false` and
  `canUpdateOwnMetadata = false`, so voice can never carry game messages. Every grant flag is set
  explicitly.
* **Mute** is the person's own client-side mute. **Block mic** = the server calls LiveKit
  `UpdateParticipant(canPublish: false)` and remembers it in room state, so a token renewed later
  also has `canPublish = false`. Lifting the block flips it back, and the person still unmutes
  themselves. **Kick** = remove from the Colyseus room, then LiveKit `RemoveParticipant`, then add
  to `bans`. The browser never holds `roomAdmin`.
* **Enforce on every join.** A token still within its TTL could be reused to rejoin, so on each
  `participant_joined` webhook the server checks room state: a banned identity → `RemoveParticipant`,
  and a blocked identity → `UpdateParticipant(canPublish: false)`. This, not the token alone, is what
  makes kick and block-mic hold.
* **Metering.** LiveKit webhooks (`participant_joined` / `participant_left`) go to the game server.
  It writes each session to `voice_usage` and keeps a month-to-date total in memory. On boot the
  total is rebuilt with `SUM(minutes)` for the current month, and sessions left open by a crash are
  closed at `joined_at + 3 h` or at the next webhook, whichever comes first. When the total
  passes `VOICE_MONTHLY_CAP_MINUTES`, new token requests return `voice_unavailable`, the UI shows
  "Voice is resting this month", and the game continues.
* **Idle disconnect.** The client leaves voice after 3 minutes with no one else in voice. The room
  removes the voice of spectators who have not opened the room screen for 3 minutes.
* **Voice failure never blocks a game.** Game sync and voice share no code path.

### Accounts and identity (apps/web)

* **Better Auth** with the anonymous plugin (every guest is a real user row with `isAnonymous`),
  Google OAuth, and the JWT plugin. On sign-in, the anonymous user is linked to the Google user and
  its matches move over (the plugin's `onLinkAccount` hook updates `match_players.user_id`).
* **What we store (corrected after review).** Better Auth requires an email column: anonymous users
  get its placeholder `{id}@anonymous.placeholder.invalid`, and the Google profile mapper stores the
  Google email (needed by Better Auth to link accounts) but **drops `image` and `name`** (we use the
  nickname). Session IP and user-agent capture is switched off. The privacy notice says exactly this.
* **Linking a guest.** In `onLinkAccount({ anonymousUser, newUser })`, one transaction moves the
  guest's `match_players` rows to `newUser.id`, **including when `newUser` is an existing account**
  (the guest's games are merged into it). The anonymous user is deleted only after that.
  `match_players.user_id` uses `ON DELETE RESTRICT`, so history can never be lost by cascade.
* **18+ is asked once, at the first join** (one checkbox on the nickname screen, remembered on the
  user as `ageConfirmedAt`). That screen therefore has a nickname field, the 18+ checkbox and the
  Join button. G1's "≤2 taps" counts the first visit as 3 actions and later visits as 1.
* The game server checks JWTs against the web app's JWKS endpoint (cached). No shared cookie is
  needed across the two domains.
* Nicknames go through a profanity filter (English + Hinglish list) and a list of reserved words
  (admin, host, heartroom).

### Data model (packages/db, Drizzle + Postgres)

```text
user            (Better Auth tables) + isAdmin bool, ageConfirmedAt, nickname
matches         id, game_id, module_version, config jsonb, seed bytea, started_at, ended_at,
                status (finished | abandoned), ranked bool, player_count, actions jsonb
match_players   match_id, user_id, seat, result (win | loss | draw), placement, win_share numeric,
                details jsonb          -- e.g. bingo lines, word-guess guesses used
voice_usage     id, room_id, user_id, joined_at, left_at, minutes
room_events     id, room_id, type, at, data jsonb   -- created, closed(reason), kicked, locked…
admin_audit     id, admin_id, action, target, at
```

* A new game needs **no migration**: everything game-specific goes into `details`/`config` as jsonb.
* `ranked = true` only when ≥2 signed-in, non-anonymous players finished, with no bot. Computed by
  the server at write time; clients never submit stats.
* `win_share` = 1/k for a shared win among k winners, 1 for a sole win, 0 for a loss.
* `actions` stays in the row for 30 days (a daily job sets it to null after that) so the Neon free
  tier does not fill up. Results and stats are kept.

### Leaderboard and stats

Queries over `match_players` joined with `matches`, filtered by `game_id`, a time window and
`player_count` band:
* **Total wins** = `sum(win_share)` over ranked matches.
* **Win rate** = `sum(win_share) / count(*)`.
* **Eligibility:** ≥10 ranked matches and ≥3 distinct opponents in the window.
* **Pair cap:** a match is ranked only if **every pair** of signed-in players in it has played
  ≤10 ranked matches together that day (Asia/Kolkata calendar day). This is checked when the match
  is written: if any pair is over the cap, `ranked` is set to false for the whole match.
* **"Mode" filter** = player-count band: `2 players` · `3–4 players` · `5–6 players`. Bingo
  leaderboards use classic config only.
* **`result = draw`** is used for a Word Guess tie (same guesses, same time) and for nobody else.
  Shared Bingo wins are `win` with `win_share = 1/k`.
* **Admin check:** the JWT carries no admin claim. The game server's `/internal/*` routes and the web
  admin APIs look up `user.isAdmin` in the database on every request.

These run as plain SQL with indexes on `(game_id, ended_at)` and `(user_id)`. Materialised views
are added only if a query gets slow.

### Admin

* `/admin` pages and their API routes check `user.isAdmin` on the server. Others get a 404.
* **Live rooms:** the game server exposes `GET /internal/rooms` (an admin-JWT-protected HTTP route
  on the same process) that returns, per room: code, game, phase, seats, spectators, voice counts,
  age, last action time, and the **public** spectator view only. **Close room** calls
  `POST /internal/rooms/:id/close`. Every admin action writes `admin_audit`.
* **Analytics:** SQL over `matches`, `match_players`, `voice_usage`, `room_events`.
* **Health:** voice minutes against the cap, rooms "stuck" (status playing, no action for 2× the
  turn timer), reconnect counts, error counts.

### Deploys and crashes

* **Deploys (corrected after review).** There is one instance, and Fly caps `kill_timeout` at 300 s,
  so there is no drain window. On `SIGTERM` the server immediately closes every room with code
  `restarting`. Clients wait 2–5 s, reconnect to the new process and `resume` from their checkpoint
  (Option A). The deploy strategy is Fly `immediate` (or Railway's default), and players see a few
  seconds of "Reconnecting…".
* **Seats nobody is playing.** If a seat's 60 s reconnection window runs out mid-game, that seat
  stays in the game and the server auto-plays it on its turns (`autoAction`). A match is
  **unranked** if any seat was auto-played on more than 2 of its turns. If **no human is
  connected** for 3 consecutive turns, the match ends with `status = abandoned` (no winner, not
  ranked) and the room returns to the lobby.
* **Crash recovery: Option A (encrypted client-held checkpoint) + client outbox. Decided by author
  2026-11-10.** Options B and C below are kept for the record.

#### Always (whichever option is chosen): a client outbox for the player's own move

Every intent gets a `clientActionId` (UUID) and the current `turnSeq`, and is kept in an in-memory
outbox until the server acknowledges it. If the socket drops, the client resends the outbox on
reconnect. The server remembers the last ~50 `clientActionId`s per room and ignores a repeat, so a
resent move is applied exactly once (the standard "idempotency key" practice used by payment APIs).
This covers network drops, but not a server crash, because after a crash the room is gone.

#### Option A: encrypted checkpoint held by the players' browsers

* **Sealing.** After every action the room seals **one** blob and sends the same blob to every
  client: `checkpoint = AES-256-GCM(CHECKPOINT_KEY, nonce = 96 random bits, snapshot)`.
  `snapshot` = the **entire room state** from "Room state" above except live sockets: `roomId`,
  `matchId`, `bootId`, `seq`, `issuedAt`, `moduleVersion`, `code`, `linkToken`, `hostId`, `locked`,
  `seats` (including block-mic flags), `spectators`, `bans`, `startSeatRotation`, `phase`, and
  `current` (config, state, seed, `actions`, `turnSeq`, deadline). A test checks that
  `restore(snapshot)` followed by `view()` gives byte-identical views to before the crash.
* The browser cannot read it (it is encrypted, so no grid, secret word or seed leaks) and cannot
  change it (GCM rejects any edit). It keeps the latest one in `sessionStorage`, about 2–4 KB for Bingo.
* **Restoring safely (fixes the roll-back attack found in review).** A losing player could otherwise
  keep an old checkpoint and resume from before the opponent's winning call. So the server:
  1. Refuses a checkpoint whose `bootId` equals its own (the room is live, so nothing to resume),
     whose `matchId` already exists in `matches` (the game finished or was abandoned), or whose room
     has a `closed` event in `room_events` (closed by the host or an admin).
  2. Accepts a checkpoint only from a `userId` seated in it, and collects resumes for that room for
     **5 s** (or until every seated user has sent one).
  3. Restores from the checkpoint with the **highest `seq`** across all players. One player's
     old copy cannot win over a newer copy held by anyone else.
  4. Restores mid-game only if **≥2 seated humans** resumed. With fewer, it restores the room to the
     **lobby** (seats, host, bans kept) and records the match as abandoned.
  5. Restores each room once. Later resumes join the restored room normally.
* **Expiry and keys.** A checkpoint expires 15 minutes after `issuedAt`, but the room re-seals one
  every 5 minutes even without actions, so idle lobbies and Chill games stay restorable.
  `CHECKPOINT_KEY` is a 32-byte environment secret, and rotation keeps `CHECKPOINT_KEY_PREVIOUS` for
  one day.
* **Pros:** costs nothing (no Redis, no extra database writes) and works across instances.
  This is the same idea as encrypted cookie sessions on the web: the server's state is stored on the
  client, sealed with a key only the server holds.
* **Cons:** if *every* player closes the tab during the crash, the game is lost (that game was over
  anyway). A few KB is added to each message. The key must be handled carefully.

#### Option B: server-side write-ahead to Postgres

* Before sending each update, the room upserts `{roomId, seq, state, seed}` into a `room_snapshots`
  table, and on boot the server reloads the rooms that were still live.
* **Pros:** the familiar pattern and a single source of truth.
* **Cons:** about 30–80 database writes per game (≈40k–80k a day at 1,000 games/day), and each
  move now waits for a database round trip of about 10–40 ms. This is still within Neon's free compute
  hours at small scale, but it is the first thing to grow.

#### Option C: accept losing live games (the earlier draft)

* Simplest. The game is recorded as `abandoned`, and players get "Server restarted. Start a new game".

**Chosen:** Option A, plus the outbox. It fits our design closely: games are small and
deterministic, the server is a single instance with no Redis, and the hidden information stays
sealed. Option B can be added later if live tournaments or longer games arrive.

### Observability

* Structured JSON logs (pino) with `roomId`, `matchId`, `userId`, `seq` on every line. The events
  logged are listed in the brief's Operations section.
* Sentry (free tier) on web and server for errors.
* The room ID is shown in the room's ⋯ menu with a Copy button, for "my game froze" reports.

### Bingo configuration (classic and custom grids)

```ts
BingoConfig = {
  size: 3..8,                 // grid is size × size, numbers 1..size²   (default 5)
  linesToWin: 1..(2*size+2),  // rows + columns + 2 diagonals             (default = size)
  timer: "fast" | "chill" | "away-only",
  setupSeconds: 30 + 2 * (size² - 25) clamped to 20..90                   // bigger grid, more time
}
```

* **Lines:** an N×N grid has N rows + N columns + 2 diagonals = 2N+2 possible lines. A grid of 3×3
  has 8, 5×5 has 12, 8×8 has 18.
* **Progress word:** classic 5 lines spells **B‑I‑N‑G‑O**. Any other target shows a progress
  strip of `linesToWin` ink rings that fill one by one ("3 / 6"). There is no forced word, so any target works.
* **Presets** in the host's picker: *Classic 5×5* (5 lines), *Quick 4×4* (4 lines), *Big 6×6*
  (6 lines), *Crazy 8×8* (8 lines), and *Custom* (both sliders).
* **Phone limit:** at 360px width an 8×8 grid gives about 40px cells, which is below the 44px tap
  target. For 7×7 and 8×8 the board uses the full width, setup defaults to Shuffle, and a
  press-and-hold preview is shown before a number is called. Sizes above 8 are not offered.
* **Bot:** works for every size (it scores lines generically).
* **Ranked and stats:** only Classic 5×5 / 5 lines is ranked. Every other setting is casual. It is
  still saved in history with `config` (size, lines), and the leaderboard has a "Classic only" scope.
* **Validation:** the server rejects a config outside these ranges (`configSchema`), and the
  module's rules never assume 5.

### Bot (vs Computer)

* `bot.ts` exports `chooseCall(view, level, rng)`. It receives **only** the bot seat's view (its
  own grid + the public state), so by type it cannot see the player's grid.
* Easy: random uncalled number. Medium: the number that completes the most of its own near-done
  lines. Hard: Medium, plus a penalty for numbers likely to help the opponent, estimated only from
  the numbers the opponent chose to call.
* vs Computer runs entirely in the browser and never talks to the server, so it never touches stats.

## Alternatives Considered

### Alternative A: Firebase (Realtime DB / Firestore) as the game backend

*   **Pros**: No server to run. Built-in auth and realtime sync. Generous free tier.
*   **Cons**: Game logic runs in each browser. Hidden grids and secret words would sit in the database
    where clients read them. Security rules cannot cleanly express "only on your turn" or "only once".
    Timers need extra Cloud Functions.
*   **Reason for Rejection**: Rejected by author: hidden information and turn order must be enforced by
    a server we control (G5).

### Alternative B: Hand-built Socket.IO server + Redis

*   **Pros**: Full control. Socket.IO is widely known. The Redis adapter scales across instances.
*   **Cons**: Rooms, seats, reconnection, presence, timers and a monitor panel would all be written by
    hand. Redis adds cost and something else to run, for a scale we do not have.
*   **Reason for Rejection**: Rejected by author: Colyseus provides these pieces and is actively
    maintained (0.17 added automatic reconnection, 0.18 added admin/database packages). A single
    process with no Redis is enough for this release.

### Alternative C: boardgame.io

*   **Pros**: Built for turn-based games with secret state (`playerView`), lobbies and bots.
*   **Cons**: Listed as being in maintenance mode, and the project is asking for a new maintainer.
*   **Reason for Rejection**: Rejected by author: we will not start a new platform on a framework
    that is no longer developed.

### Alternative D: Cloudflare Durable Objects / PartyKit (one object per room)

*   **Pros**: Each room is its own small stateful server. Scales automatically, no Redis, durable
    storage per room (which would also solve crash recovery).
*   **Cons**: Cloudflare-specific runtime and APIs, harder to run and debug locally, and it ties the
    platform to one vendor.
*   **Reason for Rejection**: Rejected by author for this release in favour of Colyseus on a plain Node
    process. Worth reconsidering if we need many regions or scale beyond one instance.

### Alternative E: Colyseus Schema sync for game state

*   **Pros**: Colyseus's built-in, delta-encoded state sync. Less code to send updates.
*   **Cons**: Puts game state into Schema classes, which clashes with pure rules modules. Per-client
    filtering of hidden fields is easy to get wrong (one missed field leaks a grid).
*   **Reason for Rejection**: Rejected by author: plain state plus `view(state, viewer)` messages
    keeps "what each person may see" in one tested function.

### Alternative F: Peer-to-peer WebRTC voice (mesh) with our own TURN server

*   **Pros**: No per-minute voice bill. Audio goes straight between browsers.
*   **Cons**: With 6 players each phone uploads 5 streams, and spectators make it worse. Some networks
    block direct connections, so a TURN server (bandwidth cost, operations) is still needed. Host
    "block mic" cannot be enforced on the server.
*   **Reason for Rejection**: Rejected by author: LiveKit relays audio and enforces publish permissions
    on the server. Its cost is controlled with opt-in voice, idle disconnect and a monthly cap.

### Alternative G: Self-hosted LiveKit from day one

*   **Pros**: About $5–10/month instead of per-minute pricing.
*   **Cons**: We run an SFU ourselves: UDP ports, TURN/TLS, updates, on-call.
*   **Reason for Rejection**: Deferred by author: start on LiveKit Cloud's free tier with metering. Move
    when the cap is reached regularly.

### Alternative H: Server-side write-ahead snapshots for crash recovery

*   **Pros**: One source of truth. Recovery does not depend on any client still being connected.
*   **Cons**: 30–80 database writes per game, and every move waits for a database round trip.
*   **Reason for Rejection**: Rejected by author: an encrypted client-held checkpoint gives recovery
    at no infrastructure cost for small, deterministic games.

### Alternative I: Separate codebase per game

*   **Pros**: Each game is free to do anything.
*   **Cons**: Rooms, voice, accounts, stats and admin would be duplicated for every game.
*   **Reason for Rejection**: Rejected by author: "overall code same, only game and stats change"
    (G12).

### Alternative J: Hosting the game server on Vercel serverless functions or Render free tier

*   **Pros**: Free, and in the same place as the website.
*   **Cons**: Serverless functions cannot keep a WebSocket open for a whole game. Render's free tier
    sleeps after 15 minutes and may restart at any time.
*   **Reason for Rejection**: Rejected: a long-running process is required (Fly.io or Railway, about
    $2–5/month).

### Alternative K: Elo-style rating for the leaderboard

*   **Pros**: Accounts for opponent strength, and harder to farm.
*   **Cons**: Multiplayer Elo for 2–6 players with shared wins is complex and hard for players to
    understand. It also needs a lot of games before it means anything.
*   **Reason for Rejection**: Rejected by author: total wins and win rate (with 1/k shared wins,
    eligibility thresholds and pair caps) are what the author asked for. A rating can be added later.

--------------------------------------------------------------------------------

## Non-Functional Requirements

*   **Security & privacy**
    *   Hidden information leaves the server only through `view()`. Every game has contract tests
        (see Verification). Checkpoints are AES-256-GCM sealed with an environment secret.
    *   Every client message is parsed with zod (`packages/protocol`). Unknown or invalid messages are
        dropped and counted. A socket that sends more than 20 messages/s is closed.
    *   Room creation is limited to 5/min per user and 20/min per IP. Code joins are limited to 10/min per IP.
    *   LiveKit tokens: one room only, server-assigned identity, 10-minute TTL, no data channel,
        no `roomAdmin` in any browser.
    *   Admin is a database flag, checked on the server for pages, APIs and the game server's internal
        routes. Every admin action is audit-logged.
    *   Data minimisation: Google `sub` + email + nickname (no photo, name, IP or user-agent), 18+ declared, voice never recorded, action logs
        removed after 30 days.
    *   Secrets (`AUTH_SECRET`, `CHECKPOINT_KEY`, `LIVEKIT_API_SECRET`, `DATABASE_URL`) live only in
        hosting environment variables and are never committed.
*   **Performance & latency**
    *   A called number appears on every player's screen in ≤300 ms (p95) inside India, with the server
        in an India region (Fly `bom` or the closest Railway region).
    *   The first room screen is interactive in ≤2.5 s on a mid-range Android phone over 4G (LCP),
        with game UIs code-split per game.
    *   One game-server process handles at least 500 concurrent rooms. A load test confirms this before launch.
*   **Rollout & rollback**
    *   Web: Vercel preview deploy for each PR, and instant rollback to the previous deployment.
    *   Game server: deploy with drain (10 min). Rollback = redeploy the previous image. Checkpoints carry
        `moduleVersion`, and a server refuses to restore a checkpoint from an unknown version.
    *   Database: forward-only Drizzle migrations, applied before deploys. A migration never removes a
        column that the running version still reads.
    *   Feature flags (environment variables): `VOICE_ENABLED`, `VOICE_MONTHLY_CAP_MINUTES`,
        `WORD_GUESS_ENABLED`, `LEADERBOARD_ENABLED`.

--------------------------------------------------------------------------------

### Additional Resources

*   [concepts-brief.md](concepts-brief.md): decisions and the Goldfish review analysis
*   [design-direction.md](design-direction.md): tokens, screens, motion, accessibility checklist
*   [research.md](research.md): next games, platform patterns, word lists, names
*   Colyseus 0.17/0.18 release notes, LiveKit tokens & grants and Room Service API, Better Auth
    anonymous/JWT plugins

### Future Improvements

*   **Server-side snapshots (Alternative H)** if games get longer or tournaments arrive.
*   **Redis + a second instance**, with rooms pinned to an instance by code, when one process is not enough.
*   **Friends system** and a friends-only leaderboard.
*   **Emoji reactions** for players and spectators (ephemeral channel).
*   **Self-hosted LiveKit** once the voice cap is reached regularly.
*   **Next games:** Raja-Mantri-Chor-Sipahi, Word Imposter, Name-Place-Animal-Thing (see research.md).
*   **Minors mode** (no profile) if under-18 users matter.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

Built in phases. Each phase ends with something the author can play, and the next phase starts only
after it passes its checks.

**Phase order (revised after the EGM review: smaller steps for one developer)**

| Phase | Contents (file numbers below) | Crash handling |
|---|---|---|
| 0 | Workspace + engine only: #1–#7. The design tokens CSS from #8 is added here, but each component is built when a screen first needs it | — |
| 1 | Bingo rules, bot, UI, vs Computer page: #9–#14 (no PWA yet) | — |
| 2a | Auth (anonymous + JWT), create/join by code, play online, results, rematch: #15–#18, #20–#23 | Option C (game lost, "start a new game") |
| 2b | Reconnect + outbox, host powers, knocks, rate limits, offline/PWA for vs Computer | Option C |
| 2c | Checkpoint crash recovery (#19) with the safe-restore rules, then a kill-the-server test | **Option A** |
| 3 → 7 | as listed below | Option A |

Option A is still the decision. It simply ships as its own step (2c) after online play works, so
that its threat model gets its own tests.

### Phase 0: Workspace and shared foundations

#### 1. `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example` (Create)

*   **Type / Scope**: Build configuration.
*   **Proposed Changes**: pnpm workspaces (`apps/*`, `packages/*`, `packages/games/*`). Strict TypeScript
    (`strict`, `noUncheckedIndexedAccess`). Root scripts: `dev`, `build`, `test`, `typecheck`, `lint`.
    `.env.example` lists every variable from the NFR section with no values.

#### 2. `eslint.config.js`, `.prettierrc`, `vitest.workspace.ts` (Create)

*   **Type / Scope**: Tooling.
*   **Proposed Changes**: ESLint flat config with a rule that bans importing `apps/*` from `packages/*`
    and bans Node/DOM globals in `packages/engine` and `packages/games/*/rules`. Vitest runs every package's tests.

#### 3. `packages/engine/src/module.ts` (Create)

*   **Type / Scope**: TypeScript module (the contract).
*   **Proposed Changes**: `GameModule`, `Viewer`, `RuleError`, `MatchResult` types exactly as in the
    Technical Plan, plus `defineGame()` (an identity helper for typing).

#### 4. `packages/engine/src/rng.ts` + `rng.test.ts` (Create)

*   **Type / Scope**: Library + unit test.
*   **Proposed Changes**: `createRng(seed: Uint8Array): Rng` (xoshiro128\*\*) with `int(min,max)`,
    `shuffle(arr)` and `pick(arr)`. `newSeed()` uses `crypto.getRandomValues`. The test checks that the
    same seed gives the same sequence and that a 1M-sample distribution is uniform enough.

#### 5. `packages/engine/src/replay.ts` + `replay.test.ts` (Create)

*   **Type / Scope**: Library + unit test.
*   **Proposed Changes**: `step(module, state, entry) → State`, where `entry` is a logged
    `{seat, action, by: "player" | "server"}`. It runs `validate` then `apply`. `replay(module, {config,
    seed, seats, actions}) → State` folds `step` over the log. The room, `LocalMatch` (vs Computer)
    and replay all call the same `step()`, so live play and replay cannot drift apart.

#### 6. `packages/engine/src/testing/view-leak.ts` (Create)

*   **Type / Scope**: Shared test helper.
*   **Proposed Changes**: `assertNoLeak(module, { scenarios, perturbHidden })`. This is an
    **indistinguishability test**, not a substring search (substrings cannot work for Bingo, where
    1–25 appear everywhere). It plays seeded random games, and after every step, for each viewer, it
    builds a second state where every hidden thing the viewer must not know is changed
    (`perturbHidden(state, viewer, rng)`: shuffle other seats' grids, replace other players' secret
    words, change the seed). It then asserts `view(state, viewer)` and `view(perturbed, viewer)` are
    byte-identical. Every game module must export `perturbHidden` and call this test.

#### 7. `packages/protocol/src/messages.ts` (Create)

*   **Type / Scope**: zod schemas.
*   **Proposed Changes**: client→server: `intent {clientActionId, turnSeq, action}`, `resync`,
    `resume {checkpoint}`, `host {kind: start|config|mute|blockMic|unblockMic|kick|lock|unlock|newCode|acceptKnock|denyKnock, target?}`,
    `voiceToken`, `rematchReady`. server→client: `room`, `game {seq, view, checkpoint}`, `ack {clientActionId}`,
    `error {code, message}`, `voiceToken {token, url}`, `knock`. Error codes are an enum mapped to
    friendly copy in the UI (never raw server text).

#### 8. `packages/ui/` (Create): `src/tokens.css`, `src/components/*`

*   **Type / Scope**: Design system.
*   **Proposed Changes**: Tailwind v4 `@theme` tokens exactly as in design-direction.md (light + dark).
    The first components are Button, IconButton, TextField, CodeInput, Sheet, Dialog, Toast (Sonner
    wrapper), Avatar, **InkRing** (draw / timer / level modes), SegmentedControl, EmptyState and Skeleton.
    Each has a reduced-motion path.

### Phase 1: Bingo rules and vs Computer (no server)

#### 9. `packages/games/bingo/src/rules.ts` (Create)

*   **Type / Scope**: Pure rules.
*   **Proposed Changes**: `BingoConfig` zod schema (size 3–8, linesToWin, timer, setupSeconds).
    State: `phase (setup|playing|done)`, `grids: (number|null)[][]` per seat, `called: number[]`,
    `turnSeat`, `deadlineAt`, `lines` per seat. Actions: `place {cell, n}`, `shuffle`, `ready`, `call {n}`.
    Functions: `setup`, `validate`, `apply`, `nextDeadline`, `autoAction` (setup timeout → random fill;
    turn timeout → random uncalled number), `linesOf(grid, called)` (2N+2 lines), `result` (all seats
    reaching `linesToWin` on the same call win together).

#### 10. `packages/games/bingo/src/view.ts` (Create)

*   **Type / Scope**: Pure function.
*   **Proposed Changes**: Seat view = own grid + called numbers + every seat's line count + turn +
    deadline. Spectator view = called numbers + line counts + turn + deadline. Once `phase === done`,
    every view includes all grids and the winning lines.

#### 11. `packages/games/bingo/src/bot.ts` (Create)

*   **Type / Scope**: Pure function.
*   **Proposed Changes**: `chooseCall(seatView, level, rng)` and `fillGrid(size, rng)`. Its parameter type
    is the seat view, so it can never read another grid.

#### 12. `packages/games/bingo/src/*.test.ts` (Create)

*   **Type / Scope**: Unit tests.
*   **Proposed Changes**: Line counting for N = 3…8. Shared win. Turn order and the alternating first
    seat (skipping empty seats). Rejects: calling out of turn, calling an already-called number, and a
    number outside 1…N². Timeout auto-actions. Replay equality. `assertNoLeak`. The bot never errors
    across 10k seeded games. Bot strength is measured on a **fixed list of 2,000 seeds** (so the test is
    deterministic, never flaky): Hard's win rate vs Easy must be at least the value found in a Phase 1
    simulation minus 3 points. A first simulation decides whether difficulty levels feel different
    at all in 1–25 Bingo. If they don't, the levels change (e.g. Easy also delays and plays randomly).

#### 13. `packages/games/bingo/src/ui/*` (Create)

*   **Type / Scope**: React components.
*   **Proposed Changes**: `BingoBoard`, `BingoCell`, `LetterStrip` / `LineProgress`, `CalledNumber`,
    `SetupBar` (tap-in-order / Shuffle), `ResultsReveal`. They render a view and emit intents, so the
    same components serve vs Computer and online play.

#### 14. `apps/web/` scaffold (Create): `app/layout.tsx`, `app/page.tsx`, `app/play/bingo/page.tsx`

*   **Type / Scope**: Next.js App Router.
*   **Proposed Changes**: Landing page (Create Room is disabled until Phase 2, "Play vs Computer" works),
    and a vs Computer page that runs the rules + bot locally with a `LocalMatch` driver (the same
    `step()` from the engine). Offline support (PWA manifest + service worker, CUJ 7) is added in Phase 2b.

**Phase 1 check:** play vs Computer on a phone at every size and level, with all tests green.

### Phase 2: Rooms and online Bingo

#### 15. `apps/server/src/index.ts`, `src/config.ts` (Create)

*   **Type / Scope**: Colyseus server bootstrap.
*   **Proposed Changes**: Defines `GameRoom`, `/healthz` and `/internal/*`. It reads environment variables
    through a zod schema and fails at boot if any is missing. It handles SIGTERM draining.

#### 16. `apps/server/src/rooms/GameRoom.ts` (Create)

*   **Type / Scope**: Colyseus Room.
*   **Proposed Changes**: Room state as in the Technical Plan. `onAuth` verifies the JWT and checks
    `bans` and `locked`. The serial action queue, `turnSeq` checks and an idempotency cache of the last
    50 `clientActionId`s per room. Per-viewer `view` broadcasts with `seq`. Timers from `nextDeadline`.
    Host commands. Knock flow. Rematch with seat rotation. `allowReconnection(60)`.

#### 17. `apps/server/src/rooms/registry.ts` (Create)

*   **Type / Scope**: Module registry.
*   **Proposed Changes**: `{ bingo: bingoModule }` (Word Guess is added in Phase 5). This is the only
    platform file a new game touches.

#### 18. `apps/server/src/rooms/codes.ts` + test (Create)

*   **Type / Scope**: Library.
*   **Proposed Changes**: Code generation from the 31-character alphabet, collision check against live
    rooms, `linkToken` generation, and a per-IP join rate limiter (token bucket in memory).

#### 19. `apps/server/src/checkpoint.ts` + test (Create)

*   **Type / Scope**: Library (crash recovery, Option A).
*   **Proposed Changes**: `seal(snapshot) → string` and `open(string) → snapshot | null` using
    AES-256-GCM with `CHECKPOINT_KEY` (plus `CHECKPOINT_KEY_PREVIOUS` for rotation). Checks `issuedAt`
    (15 minutes) and `moduleVersion`. `restoreRoom(checkpoints[])` picks the highest `seq` and restores once.
    Tests: round trip, tamper → null, expired → null, wrong key → null.

#### 20. `apps/server/src/persistence/matches.ts` (Create)

*   **Type / Scope**: Database writes.
*   **Proposed Changes**: `recordMatch(room, result)` writes `matches` + `match_players`, computes
    `ranked` (≥2 signed-in humans, classic config only, pair cap) and `win_share`.

#### 21. `packages/db/src/schema.ts`, `drizzle.config.ts`, `migrations/*` (Create)

*   **Type / Scope**: Drizzle schema.
*   **Proposed Changes**: The tables from the Data model section, with indexes on
    `match_players(user_id)`, `matches(game_id, ended_at)` and `voice_usage(joined_at)`.

#### 22. `apps/web/app/r/[code]/page.tsx`, `app/room/[id]/page.tsx`, `lib/room-client.ts` (Create)

*   **Type / Scope**: Pages + client.
*   **Proposed Changes**: Room preview → nickname → join (≤2 taps). `room-client.ts` wraps the
    Colyseus client: outbox with `clientActionId`, resend on reconnect, `seq` gap → `resync`, saves the
    checkpoint to `sessionStorage`, and calls `resume` on a fresh server. The room screen holds the lobby
    (SeatGrid, SpectatorStrip, HostMenu, ShareRoom) and the game area rendered by the module's UI.

#### 23. `apps/web/lib/auth.ts`, `app/api/auth/[...all]/route.ts` (Create)

*   **Type / Scope**: Better Auth.
*   **Proposed Changes**: Anonymous plugin (every guest gets a user row), JWT plugin + JWKS route for the
    game server. Google is enabled in Phase 4. Nickname profanity/reserved-word filter.

**Phase 2 check:** 4 phones play a full Bingo game. Kill the server mid-game, and the game resumes
from the checkpoint. Refresh a phone mid-turn, and it gets the same seat and grid. A spectator sees
no grids (verified in the browser's network tab as well).

### Phase 3: Voice

#### 24. `apps/server/src/voice/VoiceAdapter.ts`, `voice/webhooks.ts` (Create)

*   **Type / Scope**: LiveKit integration.
*   **Proposed Changes**: `mintToken(room, user, canPublish)` with explicit grants. `blockMic` /
    `unblockMic` via `UpdateParticipant`. `kick` via `RemoveParticipant`. A webhook route (signature
    verified) writes `voice_usage` and updates the month-to-date total. The cap refuses new tokens.

#### 25. `apps/web/components/voice/*` (Create)

*   **Type / Scope**: React.
*   **Proposed Changes**: `VoiceDock` (Join voice, Mic, Speaker, Leave), `SpeakingRing` (InkRing level
    mode from `useTrackVolume`), the host-muted / blocked banner, the headphones tip, and a 3-minute idle
    leave. On iOS: an explicit tap starts audio playback, and there is a "Tap to reconnect voice" state.

**Phase 3 check:** voice works on Android Chrome and iPhone Safari. A blocked user cannot talk even
from a modified client (try publishing with an old token). Voice minutes appear in the database.

### Phase 4: Accounts and history

#### 26. `apps/web/lib/auth.ts` (Modify), `app/(account)/profile/page.tsx` (Create)

*   **Type / Scope**: Auth + page.
*   **Proposed Changes**: Google provider with minimal scopes. The 18+ confirmation is saved as
    `ageConfirmedAt`. `onLinkAccount` moves the guest's `match_players` rows to the new account. The
    profile page shows a per-game stat row and the match history.

### Phase 5: Word Guess

#### 27. `packages/games/word-guess/src/{rules,feedback,view,words}.ts` + tests + `ui/*` (Create)

*   **Type / Scope**: Game module.
*   **Proposed Changes**: Config (length 4–7, guesses length…10). Both players set a word and both
    guess. `feedback(secret, guess)` uses the two-pass rule. Word lists are bundled on the **server
    only**: `common/{4..7}.txt` (SCOWL ≤50, with its licence notice) and `valid/{4..7}.txt` (ENABLE).
    The view hides the secret until the end. UI: `WordRow`, `WordTile` (colour + shape + aria-label),
    `GameKeyboard`, and the setter's live view. Tests: APPLE/PAPAL, SPEED/ABIDE, EVADE/CEASE,
    `assertNoLeak`, word-list validation.
*   **Platform change**: one line in `registry.ts`. Nothing else in `apps/server` changes (G12).

### Phase 6: Leaderboard

#### 28. `apps/web/app/leaderboard/page.tsx`, `lib/queries/leaderboard.ts` (Create)

*   **Type / Scope**: Page + SQL.
*   **Proposed Changes**: Filters in the URL (nuqs): game, week/month/all time, player-count band.
    SQL as in the Technical Plan (`sum(win_share)`, eligibility, classic-only for Bingo). Your own row
    sticks to the bottom.

### Phase 7: Admin

#### 29. `apps/web/app/admin/*`, `lib/queries/admin.ts`, `apps/server/src/internal/rooms.ts` (Create)

*   **Type / Scope**: Pages + internal API.
*   **Proposed Changes**: Live rooms (with the public view inspector and Close Room), analytics (games
    per game, wins per user per game, abandoned rate), health (voice minutes against the cap, stuck rooms,
    reconnects, errors). Server-side `isAdmin` checks and `admin_audit` writes.

### Verification Plan

*   **Compilation/Build**: `pnpm typecheck` and `pnpm build` (web + server) on every PR.
*   **Unit Tests**: `pnpm test` (Vitest): rules, feedback, RNG, replay, checkpoint, codes, and
    `assertNoLeak` for every game.
*   **Static Analysis & Linting**: `pnpm lint` (ESLint with import boundaries) + Prettier check.
*   **Test Coverage Requirement**: ≥90% branch coverage on `packages/engine` and
    `packages/games/*/src` (excluding `ui/`). The platform code has no target but must cover the action queue and checkpoint paths.
*   **E2E/Integration**: Playwright with 3 browser contexts (host, player, spectator): create → join by
    link → play Bingo to the end → rematch. It also checks that a spectator's WebSocket frames never
    contain a grid, kills and restarts the game server mid-game and expects a resume, and takes over a
    seat from a second tab.
*   **Load**: a script with 500 simulated rooms × 4 bots against one server process. Pass when p95
    action→broadcast is under 100 ms on the server and memory stays flat.
*   **Manual**: voice on a real Android phone and a real iPhone (Phase 3 check).

--------------------------------------------------------------------------------

*Drafted with EGM*
