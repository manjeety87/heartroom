# Status

_Update this file at the end of every working session (any agent, any device)._

**Last updated:** 2026-11-11
**Phase:** Phase 1 done (owner checked on a phone) + UI redesign → next is the Colyseus spike (Q2), then Phase 2a.

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

## Next

1. **Owner check of the redesign** on a phone: Settings (name, colour, every theme in light and dark,
   Make your own, text size), a game at 5×5 and 8×8 (two-tap call), results, History step-through,
   sounds and vibration. Same commands as before (`build`, then `start`, open `/play/bingo`).
2. **Open Question Q2 (Colyseus spike)**, then **Phase 2a** (#15–#18, #20–#23). The room must honour
   `Deadline.key` / `onlyWhenAway`, give each joiner a free player colour, and keep names unique
   per room (`docs/design/ui-system.md` › Names, Player colours).
3. Still open: Q1 (pricing), Q3 (name check).

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
- Bot strength tests use 2,000 fixed seeds; if a bot change fails them, the levels moved closer together.
