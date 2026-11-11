# Status

_Update this file at the end of every working session (any agent, any device)._

**Last updated:** 2026-11-10
**Phase:** Planning complete → next is the design review, then Phase 0.

## Done

- [x] Concept + rules agreed (Bingo 1–25 incl. custom grids, Word Guess, rooms, voice, spectators,
      accounts, leaderboard, admin). See `docs/DECISIONS.md`.
- [x] Goldfish review of the concept (4 lenses), games research and the design system.
- [x] Full design doc drafted: `docs/design/heartroom-design.md`.
- [x] Repo created with agent docs (AGENTS.md, CLAUDE.md), `main` + `dev` branches.

## Next

1. Run a fresh `egm-review` on `docs/design/heartroom-design.md` and resolve its findings.
2. Answer the design doc's Open Questions Q1 (pricing), Q2 (Colyseus spike), Q3 (name check).
3. **Phase 0:** workspace, `packages/engine` (contract, RNG, replay, leak test), `packages/protocol`,
   `packages/ui` tokens. See "Detailed Implementation Plan → Phase 0" in the design doc.

## Phases

| Phase | Scope | State |
|---|---|---|
| 0 | Workspace, engine, protocol, UI tokens | not started |
| 1 | Bingo rules + vs Computer (offline) | not started |
| 2 | Rooms (Colyseus) + online Bingo + crash recovery | not started |
| 3 | Voice (LiveKit) + host powers | not started |
| 4 | Google login + history | not started |
| 5 | Word Guess | not started |
| 6 | Leaderboard | not started |
| 7 | Admin dashboard | not started |

## Notes for the next session

- The repo is public, so never commit secrets or personal data.
