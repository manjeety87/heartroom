# Setting up a new laptop (or a collaborator)

## 1. Get the code

```bash
gh repo clone manjeety87/heartroom
cd heartroom
git switch dev
```

Requirements once code exists: Node 22+, pnpm (`corepack enable`), Git.

## 2. Agent skills (optional, saves time and tokens)

Skills are installed per machine, so run these once on each laptop. They work with Claude Code,
Codex, Gemini CLI, Copilot and others.

**Planning and review**
```bash
npx skills add google/elephant-goldfish-model -g -y
```

**Handoff between sessions and devices, writing for agents, context budget**
```bash
npx skills add mattpocock/skills@claude-handoff -g -y
```
```bash
npx skills add mattpocock/skills@writing-for-agents -g -y
```
```bash
npx skills add addyosmani/agent-skills@context-engineering -g -y
```

**Git workflow and commits**
```bash
npx skills add addyosmani/agent-skills@git-workflow-and-versioning -g -y
```
```bash
npx skills add github/awesome-copilot@conventional-commit -g -y
```

**Stack**
```bash
npx skills add jeffallan/claude-skills@websocket-engineer -g -y
```
```bash
npx skills add wshobson/agents@nextjs-app-router-patterns -g -y
```
```bash
npx skills add better-auth/skills@better-auth-best-practices -g -y
```
```bash
npx skills add currents-dev/playwright-best-practices-skill@playwright-best-practices -g -y
```
```bash
npx skills add colyseus/skill@colyseus -g -y
```

The "Failed to install … PromptScript" lines at the end of an install are harmless: that one tool
does not support global installs.

## 3. How work carries across devices and agents

There is no hidden memory. Everything an agent needs is in the repo:

- `AGENTS.md`: rules + read order (Claude reads it through `CLAUDE.md`)
- `docs/STATUS.md`: where we are and what's next. **Update it and commit before you stop.**
- `docs/DECISIONS.md`: what's decided

So on any laptop: `git pull` → open your agent in the folder → "read AGENTS.md and continue from
docs/STATUS.md".
