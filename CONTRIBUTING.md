# Contributing

## Branches

- `main`: **production**. Whatever is on `main` is what runs live (production deploys are built from
  `main` only). Updated by a PR from `dev`. Direct pushes are blocked by branch protection.
- `dev`: **development**. Daily work lands here, and preview/staging deploys are built from `dev`.
- `feat/<name>`, `fix/<name>`, `docs/<name>`: your work, branched from `dev`, merged back by PR.

```bash
git switch dev && git pull
git switch -c feat/bingo-line-count
# work, commit in small steps
git push -u origin feat/bingo-line-count   # then open a PR into dev
```

## Commits

Commit every time a step works (it builds and the tests pass). Use
[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(bingo): count lines for any N×N grid

Lines = N rows + N columns + 2 diagonals. linesOf() now takes the grid size
from the grid itself instead of assuming 5. Tested for N = 3…8.
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, `build`. Scopes: `engine`,
`protocol`, `ui`, `db`, `server`, `web`, `bingo`, `word-guess`, `voice`, `auth`, `admin`.

## Before you push

- `pnpm typecheck && pnpm lint && pnpm test` pass (once code exists).
- No secrets: copy `.env.example` to `.env.local`, which is git-ignored. **This repo is public.**
- If you changed the plan, update `docs/STATUS.md` / `docs/DECISIONS.md` in the same PR.

## Using an AI coding agent

Point it at [AGENTS.md](AGENTS.md) first. It lists the read order and the rules that are easy to break.
