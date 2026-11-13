import { randomUUID } from "node:crypto";
import { createEndpoint, createRouter, defineRoom, defineServer, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { LIMITS } from "@heartroom/protocol";
import { createTokenVerifier } from "./auth/verify-token.ts";
import { createSealer } from "./checkpoint.ts";
import { connectPostgres } from "@heartroom/db";
import { createDbStore } from "./persistence/store.ts";
import { parseConfig } from "./config.ts";
import { createLogger } from "./logger.ts";
import { isAllowedOrigin } from "./origin.ts";
import { createGameRoom } from "./rooms/GameRoom.ts";
import { WebhookReceiver } from "livekit-server-sdk";
import { createVoiceMeter, createVoiceUsageStore } from "./voice/usage.ts";
import { createVoice } from "./voice/voice.ts";
import { createWebhookHandler, webhookEndpoint } from "./voice/webhooks.ts";

const config = (() => {
  try {
    return parseConfig(process.env);
  } catch (error) {
    // The logger needs LOG_LEVEL from config, so a config failure goes straight to stderr.
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();

const log = createLogger(config.LOG_LEVEL);
/** Changes on every boot, so a client (and the logs) can tell a restart from a reconnect. */
const bootId = randomUUID();

for (const event of ["uncaughtException", "unhandledRejection"] as const) {
  process.on(event, (error) => {
    log.fatal({ event, err: error }, "process_crash");
    process.exit(1);
  });
}

const verifyToken = createTokenVerifier({
  isProduction: config.isProduction,
  keys: new URL(config.AUTH_JWKS_URL),
});

const sealer = createSealer({
  current: config.CHECKPOINT_KEY,
  previous: config.CHECKPOINT_KEY_PREVIOUS,
});

// The game never waits on this: rooms write matches and events in the background.
const db = connectPostgres(config.DATABASE_URL);
const store = createDbStore(db);

const voice = createVoice(config.voice, log);
const meter = createVoiceMeter({
  store: createVoiceUsageStore(db),
  capMinutes: config.VOICE_MONTHLY_CAP_MINUTES ?? null,
  log,
});
if (voice.isEnabled) await meter.boot();
log.info({ event: "voice", enabled: voice.isEnabled, monthMinutes: meter.monthMinutes() }, "voice");
// Only LiveKit calls this, signed with our API secret; without voice there is nothing to receive.
const onWebhook =
  config.voice === null
    ? null
    : createWebhookHandler({
        receiver: new WebhookReceiver(config.voice.apiKey, config.voice.apiSecret),
        voice,
        meter,
        log,
      });

const transport = new WebSocketTransport({
  maxPayload: LIMITS.MESSAGE_BYTES,
  beforeUpgrade(request) {
    const origin = request.headers.get("origin");
    if (isAllowedOrigin(origin, config.ALLOWED_ORIGINS)) return;
    log.warn({ event: "origin_refused", origin }, "origin_refused");
    return new Response(null, { status: 403 });
  },
});

const server = defineServer({
  transport,
  greet: false,
  // One room type for every game; the host picks the game inside the room.
  rooms: {
    room: defineRoom(
      createGameRoom({
        verifyToken,
        log,
        sealer,
        bootId,
        store,
        voice,
        isVoiceResting: () => meter.isResting(),
      }),
    ),
  },
  routes: createRouter({
    healthz: createEndpoint("/healthz", { method: "GET" }, () =>
      Promise.resolve({ ok: true, bootId, rooms: matchMaker.stats.local.roomCount }),
    ),
    livekitWebhook: webhookEndpoint(onWebhook),
  }),
});

await server.listen(config.PORT);
log.info({ event: "server_started", port: config.PORT, bootId }, "server_started");
