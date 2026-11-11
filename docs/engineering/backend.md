# Backend engineering standards

Scope: `apps/server` (Colyseus), the server half of `apps/web` (Better Auth, read APIs), and `packages/*`.
**If this file and the [design doc](../design/heartroom-design.md) disagree, the design doc wins.**
Research (2026-11-10): nodejs-backend-patterns, node, api-and-interface-design, websocket-engineer and
vibesec skills, the repos under Sources, and what worked in `shiftbuddy-backend`.

## Principles

1. **Validate at the edge, trust inside.** Every input is zod-parsed once: WS message, HTTP body, env,
   JWT claim, webhook, and jsonb read back for a restore. *(OWASP Input Validation)*
2. **Fail fast, fail closed.** Bad config stops the boot, unknown messages are dropped, and failed auth
   is refused. *(nodebestpractices §1, §6)*
3. **Keep operational errors separate from programmer errors.** Expected failures become typed codes.
   Bugs crash loudly and get reported. *(nodebestpractices §2)*
4. **`view()` is the only exit for game state**, and that includes logs and errors.
5. **Contract first, additive changes only.** `packages/protocol` is the API: add optional fields,
   never change or remove existing ones (Hyrum's law).
6. **Pure core, thin shell.** Rules and the engine are deterministic. I/O happens only in `apps/*`.
7. **Boring and small beats clever.** One process, no Redis, and no abstraction until there is a second use.

## Project structure

```
apps/server/src/
  index.ts            boot: config → logger → Sentry → db → Colyseus → signals
  config.ts           the ONLY reader of process.env
  logger.ts           pino root + child helpers
  errors.ts           AppError + toClientError()
  auth/verify-jwt.ts  jose + remote JWKS (created once)
  rooms/GameRoom.ts   lifecycle wiring only; logic lives in rooms/*.ts
  rooms/registry.ts   the one line a new game touches
  rooms/{codes,queue,idempotency,rate-limit}.ts
  checkpoint.ts       seal / open / restore (AES-256-GCM)
  persistence/        matches.ts, room-events.ts (Drizzle only here)
  voice/              VoiceAdapter.ts, webhooks.ts
  http/               healthz.ts, internal/* (admin-guarded)
  utils/              small pure helpers
packages/protocol/src   zod schemas + types + ERROR_CODES + CLOSE_CODES
packages/engine/src     contract, rng, step/replay, testing/
packages/games/<id>/src rules.ts, view.ts, bot.ts, module.ts, ui/, *.test.ts
packages/db/src         schema.ts, client.ts (factory), migrations/
```

- Tests sit next to the code (`x.ts` + `x.test.ts`). Shared helpers go in `src/testing/`.
- `packages/*` never imports `apps/*`. Engine and rules use no Node or DOM globals (ESLint enforces both).
- Each package has one public `exports` entry (`src/index.ts`), and nothing imports deeper than that.

## TypeScript & modules

- Node ≥22.12 (the owner's machines). ESM only (`"type": "module"`). `NodeNext` resolution for the
  server and packages, `Bundler` for Next.
- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. No
  `enum`, `namespace`, parameter properties or decorators: use `as const` objects + unions instead.
- Internal packages ship TS source (the create-t3-turbo pattern). The server runs on `tsx` in dev and
  as an esbuild bundle in prod.
- `import type` for types, the `node:` prefix for built-ins, no `any` (use `unknown` + zod at
  boundaries), branded IDs (`UserId`, `RoomId`, `MatchId`), and exhaustive `switch` with `assertNever`.

## Config / env

- `config.ts` zod-parses `process.env` at import. On failure it prints **names and reasons only, never
  values**, then calls `exit(1)`. Carried over from shiftbuddy `env.js`: an empty `KEY=` means unset,
  a `list` transform for comma lists, a frozen export, and `isProduction`.
- `CHECKPOINT_KEY` must be base64 of exactly 32 bytes. Flags are `z.enum(['true','false'])` transformed
  to booleans. In production, a wildcard `ALLOWED_ORIGINS` is refused.
- `.env.example` lists every name with no values. The repo is public, so CI runs `gitleaks`.

## Errors

- `AppError(code, { cause?, meta? })`. Codes are a `const` in `packages/protocol`: `ROOM_NOT_FOUND`,
  `ROOM_LOCKED`, `BANNED`, `STALE_TURN`, `NOT_YOUR_TURN`, `RULE_VIOLATION`, `RATE_LIMITED`,
  `UNAUTHORIZED`, `INVALID_MESSAGE`, `CHECKPOINT_REJECTED`, `INTERNAL`.
- **The wire carries `{ code, message }` only.** `message` comes from a server map of safe copy. The
  web client can show its own copy per code. `meta` and `cause` go to logs only.
- `toClientError(err)` maps known library errors (zod, Postgres `23505`, jose `JWTExpired`). Anything
  else becomes `INTERNAL`, is logged at `error` and sent to Sentry.
- Rule errors never mention hidden data ("not your turn" is fine, "that number is on seat 2's grid" is not).
- On `unhandledRejection` / `uncaughtException`: log at fatal, flush and `exit(1)`.
- WS close codes 4000–4999: `RESTARTING 4001`, `KICKED 4002`, `BANNED 4003`, `TAKEN_OVER 4004`, `ROOM_CLOSED 4005`.

## Validation

- Every inbound WS message type gets `safeParse`. An invalid message is dropped and counted. After 10
  invalid messages in a minute, close the socket with `INVALID_MESSAGE`.
- Game intents use `module.actionSchema` and configs use `configSchema`. Schemas are `.strict()`, and
  every string and array has a `.max()`. Nicknames are trimmed, NFC-normalised, 1–20 characters, then filtered.
- Third-party payloads are parsed too (LiveKit webhooks, after the signature check).

## Logging & observability

- pino writes JSON to stdout. Use a `child({ roomId })` per room and a `child({ matchId })` per match.
  Fields: `roomId`, `matchId`, `userId`, `seq`, `turnSeq`, and a stable snake_case `event`
  (`room_created`, `action_applied`, `reconnect`, `checkpoint_restored`…).
- **Redact** `*.token`, `*.authorization`, `*.cookie`, `*.checkpoint`, `*.seed`, `*.state`,
  `*.secretWord`, `*.grid` and `req.headers`. Never log a payload, only its `type` and size.
- Sentry on the server and in Next: `sendDefaultPii: false`, and `beforeSend` strips the same keys.
  Tag events with `roomId`/`matchId`.
- `/healthz` returns `{ ok, bootId, rooms }`. Counters go to the logs: rooms, clients, invalid messages,
  rate-limit hits and restores.

## Security checklist

- [ ] **JWT:** `jose.jwtVerify` with `createRemoteJWKSet(<web>/api/auth/jwks)` created **once**. Pin
      `algorithms`, `issuer` and `audience`, require `exp`, and allow ≤30 s clock skew. Verify in
      Colyseus static `onAuth`.
- [ ] **Origin:** reject a WS upgrade whose `Origin` is not in `ALLOWED_ORIGINS`. HTTP CORS uses the same list.
- [ ] **Rate limits** (in-memory token buckets): create room 5/min/user and 20/min/IP. Join by code
      10/min/IP. More than 20 messages/s on a socket → close it. `TRUST_PROXY` is set to the real hop count.
- [ ] **Size limits:** WS payloads ≤8 KB (a larger cap only for `resume`), HTTP bodies ≤100 KB, and a
      maximum number of rooms per process.
- [ ] **Secrets:** env only, never in logs, errors or the client bundle (`NEXT_PUBLIC_*` reviewed in
      every PR). Rotation uses `_PREVIOUS` keys.
- [ ] **Authorization:** host commands check `hostId` on the server. `/internal/*` and admin APIs check
      `isAdmin` in the database, write an audit row, and return 404 to non-admins.
- [ ] **Checkpoints:** AES-256-GCM with a random 96-bit nonce, plus the safe-restore rules in the design doc.
- [ ] **Webhooks:** verify the LiveKit signature before parsing.
- [ ] **IDs and codes:** UUIDv7 for database rows. Codes and link tokens come from `node:crypto`, never `Math.random`.
- [ ] **Dependencies:** commit `pnpm-lock.yaml`. CI runs `pnpm install --frozen-lockfile` and
      `pnpm audit --prod` (high severity fails). Dependabot runs weekly. A new dependency needs a
      one-line reason in the PR.
- [ ] **HTTP headers (Next):** CSP, HSTS, `nosniff`, `frame-ancestors 'none'`.

## Realtime / Colyseus

- **One serial queue per room** (`rooms/queue.ts`). Intents, timers, host commands and webhook effects
  all go through `enqueue`, and nothing mutates room state outside the handler.
- **Intents** carry `{ clientActionId, turnSeq }`. A stale `turnSeq` gets `STALE_TURN` and a full view.
  A duplicate `clientActionId` (ring of 50) is re-acknowledged but not re-applied. A timer captures
  `turnSeq` when it is set, and does nothing if `turnSeq` has moved on.
- **Broadcasts:** each viewer gets `game { seq, view }`. A gap in `seq` triggers `resync` from the client.
- **Reconnect:** `allowReconnection(client, 60)` only for non-consented drops. When the same `userId`
  connects again, the newest socket wins and the old one is closed with `TAKEN_OVER`.
- **Leave / dispose** cleans up timers, the voice participant, the released code and the `room_events` row.
- **Shutdown** (SIGTERM/SIGINT): stop joins, seal a final checkpoint per room, disconnect everyone with
  `RESTARTING`, close the DB pool, flush logs and Sentry, and exit within about 10 s.
- **Pin the exact Colyseus version** after the Q2 spike. Confirm `maxMessagesPerSecond` and static `onAuth` in it.

## Database

- Drizzle schema lives in `packages/db`. `drizzle-kit generate`, review the SQL, commit it, and
  `drizzle-kit migrate` before deploy. Never `push` to shared databases. Migrations are forward-only
  (expand → migrate → contract).
- `recordMatch` writes `matches` + `match_players` in **one transaction** and is idempotent (a
  server-made UUID, so a duplicate insert counts as already recorded).
- Indexes: `match_players(user_id)`, `matches(game_id, ended_at)`, `voice_usage(joined_at)`,
  `room_events(room_id, type)`.
- FKs: `match_players.match_id → matches ON DELETE CASCADE`. `match_players.user_id → user ON DELETE
  RESTRICT` (per the design doc: a guest's rows are moved before the anonymous user is deleted).
  Deleting an account explicitly nulls its `user_id` rows first. `admin_audit.admin_id ON DELETE SET NULL`.
- No N+1 queries: use joins or `inArray`, and paginate every list. Use the Neon pooled URL with a small
  pool, and keep the database out of the game hot path.
- Never build SQL from strings. Use the `sql` template only, and whitelist `ORDER BY` columns.

## Testing

- **Pyramid:**
  1. Pure unit tests: rules, rng, replay, codes, checkpoint.
  2. Per-game `assertNoLeak` and replay property tests.
  3. Integration: `GameRoom` via `@colyseus/testing` with real messages (queue race, stale turn,
     duplicate action, reconnect, takeover, restore).
  4. A few Playwright E2E tests for the CUJs.
- **Database tests** run on real Postgres (Testcontainers or a Neon branch) with migrations applied.
  Do not mock Drizzle.
- **Determinism:** fixed seeds, `vi.useFakeTimers()`, an injected `now()`, no sleeps, and Playwright
  `retries: 0` locally.
- **Test data:** factories (`makeSeats`, `makeConfig`), with each test owning its data. Use AAA
  structure and name tests "when X, then Y". A bug gets a regression test first.

## Performance

- ≤300 ms p95 from call to screen, and ≥500 rooms per process. Handlers stay synchronous and cheap,
  with one view computed per viewer per action.
- No awaiting I/O inside the queue, except `recordMatch` after the broadcast. Per-room memory is capped
  (action log, idempotency ring, knocks). Load-test WebSockets (k6/Artillery) before launch.

## Code style

- Prettier + ESLint flat config (typescript-eslint `strict-type-checked`).
- Files are kebab-case (`GameRoom.ts` is the class exception). Constants are `UPPER_SNAKE`, and wire
  `type` values are `snake_case`. Booleans start with `is`/`has`/`can`.
- Functions stay around 40 lines or fewer, with early returns. Comments explain *why*. No dead code.

## Carried over from shiftbuddy-backend

**Keep:** the single zod env module, the `toApiError` mapping with a generic fallback, the rate-limiter
factory (user-keyed when signed in, otherwise IP), `TRUST_PROXY`, the boot-time DB ping, and the
shutdown timeout. **Leave behind:** CommonJS, `console`/morgan (replaced by pino), the
`{ success, message }` shape (replaced by `{ code, message }`), and dev-mode `err.message` leaks.

## Sources (stars as of 2026-11-10)

goldbergyoni/nodebestpractices 105.7k · microsoft/playwright 99.8k · colinhacks/zod 44.3k ·
drizzle-team/drizzle-orm 36.3k · OWASP/CheatSheetSeries 34.0k · vercel/turborepo 31.3k ·
better-auth/better-auth 30.7k · goldbergyoni/javascript-testing-best-practices 24.6k · pinojs/pino 18.3k ·
vitest-dev/vitest 17.4k · getsentry/sentry-javascript 8.8k · panva/jose 7.9k · colyseus/colyseus 7.5k ·
t3-oss/create-t3-turbo 6.1k · Colyseus docs (auth, lifecycle, 0.17 release) · Better Auth JWT plugin docs.
