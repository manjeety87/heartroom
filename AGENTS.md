# AGENTS.md: instructions for any coding agent (Claude, Codex, Gemini, Copilot, Cursor…)

Keep this file short. It holds rules and pointers only, and the details live in the linked docs.
Read only what the current task needs.

## What this project is

**Heartroom** is a website where friends open a private room (code or link), play short games
together and talk by voice. Launch games: **Bingo 1–25** (2–6 players, custom 3×3…8×8 grids, vs
Computer) and **Word Guess** (each player sets a word for the other). The platform (rooms, voice,
spectators, accounts, stats, leaderboard, admin) is shared, and each game is a plug-in module.

## Read order (stop when you have enough)

1. `docs/STATUS.md`: where the work stands, the current phase, and the next task. **Always read this.**
2. `docs/DECISIONS.md`: decisions already made. Do not reopen them unless the user asks.
3. `docs/design/heartroom-design.md`: the full design doc (architecture, contract, phases, file plan).
   Read only the section your task needs.
4. `docs/design/design-direction.md`: design tokens, screens, motion, accessibility, for any UI work.
5. `docs/design/concepts-brief.md` and `docs/design/research.md`: background and why things are the way they are.

## Stack (planned; see the design doc for details)

pnpm workspaces · TypeScript strict · Next.js (App Router) on Vercel · Colyseus game server (Node,
one process) on Fly.io/Railway · Postgres (Neon) + Drizzle · Better Auth (anonymous + Google + JWT) ·
LiveKit Cloud (voice) · Tailwind v4 · Base UI · Motion · Sonner · Vitest · Playwright · zod.

## Rules that are easy to break

- **Hidden information leaves the game server only through `view(state, viewer)`.** Never send raw
  game state, the seed, another player's grid or a secret word to a client, a log line or an error
  message. Every game module must pass `assertNoLeak`.
- **Game rules are pure** (`packages/engine`, `packages/games/*/src`): no clock, no I/O, no
  `Math.random`. Randomness comes only from the seeded `Rng`.
- **A new game must not change platform code** beyond one line in `apps/server/src/rooms/registry.ts`.
- **The client never decides results or stats.** The server computes `ranked` and `win_share`.
- **Never put secrets in the repo.** Use `.env.local` (git-ignored) and copy names from `.env.example`.
  **This repo is public.**
- **UI:** use the design tokens and the InkRing motif. No `transition: all`, no ease-in, respect
  reduced motion, and never colour alone for meaning.
- **No dead code.** Delete it rather than commenting it out. Helpers go in `utils/`/`lib/`, and every
  message is validated with zod.

## Git workflow (required)

- **`main` = production** (live site, deployed only from `main`). **`dev` = development** (daily work,
  preview deploys). Work on `dev`. `main` changes only by a PR from `dev` (enforced by branch
  protection). Never commit or push to `main` directly.
- **Commit after every working step** (small, self-contained, builds and tests pass), so any change
  can be traced and reverted.
- Commit messages follow Conventional Commits and explain *what* and *why*:
  `feat(bingo): add line counting for N×N grids` + a body describing the change and how it was checked.
- A collaborator works on a branch from `dev` (`feat/<short-name>`) and opens a PR into `dev`.
- **Before ending a session:** update `docs/STATUS.md` (what changed, what's next), add any new
  decision to `docs/DECISIONS.md`, and commit them.

## Checks before every commit (once code exists)

`pnpm typecheck` · `pnpm lint` · `pnpm test`. For UI work, the user tests it themselves on their device,
so say what to check.

## Working style with the user

The user writes in Hinglish, and replying in the same register is fine. They are on limited
LLM usage, so work in small vertical slices, leave the repo working at the end of each session, and
don't re-read big docs unnecessarily.
