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
