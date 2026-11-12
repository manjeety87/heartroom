# Status

_Update this file at the end of every working session (any agent, any device)._

**Last updated:** 2026-11-11
**Phase:** Phase 1 built → owner checks vs Computer on a phone, then Phase 2a (rooms, online Bingo).

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

## Next

1. **Owner check (Phase 1 exit):** on the laptop run `pnpm --filter @heartroom/web build` then
   `pnpm --filter @heartroom/web start`, and open `http://<laptop-ip>:3000/play/bingo` on a phone on the
   same Wi-Fi (the production server avoids Next's dev-only cross-origin block for LAN IPs). Play every preset + a custom size at each level. Check: tap-in-order, Shuffle keeps
   tapped numbers, the computer's turns, results reveal, Rematch (first caller alternates), light + dark.
2. **Phase 1 gaps (small, do before or with Phase 2a):** press-and-hold preview before calling on
   7×7/8×8 (cells are ~36 px at 375 px wide), win sequence motion (letters fill, grid lift, flip-in
   stagger), the 3 sounds + Android haptics, `loading.tsx` / `error.tsx` and a per-game error boundary.
3. **Before Phase 2:** Open Question Q2 (Colyseus spike), then Phase 2a (#15–#18, #20–#23).
   The room must honour `Deadline.key` / `onlyWhenAway` (see DECISIONS 2026-11-11).
4. Still open: Q1 (pricing), Q3 (name check).

## Phases

| Phase | Scope | State |
|---|---|---|
| 0 | Workspace, engine, protocol, UI tokens | done 2026-11-11 |
| 1 | Bingo rules + vs Computer (offline) | built 2026-11-11, owner phone check pending |
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
- Bot strength tests use 2,000 fixed seeds; if a bot change fails them, the levels moved closer together.
