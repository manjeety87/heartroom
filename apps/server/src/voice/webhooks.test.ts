import { createHash } from "node:crypto";
import { createRouter, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { AccessToken, WebhookReceiver } from "livekit-server-sdk";
import { afterEach, describe, expect, it } from "vitest";
import { createLogger } from "../logger.ts";
import type { VoiceMeter } from "./usage.ts";
import type { Voice } from "./voice.ts";
import { createWebhookHandler, voiceGuards, webhookEndpoint } from "./webhooks.ts";

const KEY = "test-key";
const SECRET = "test-secret-that-is-long-enough-for-hs256";

const calls: string[] = [];
const voice: Voice = {
  isEnabled: true,
  url: "wss://voice.test",
  mintToken: () => Promise.resolve("t"),
  setCanPublish: (_room, identity, canPublish) => {
    calls.push(`${canPublish ? "allow" : "block"}:${identity}`);
    return Promise.resolve();
  },
  remove: (_room, identity) => {
    calls.push(`remove:${identity}`);
    return Promise.resolve();
  },
};
const meter: VoiceMeter = {
  boot: () => Promise.resolve(),
  joined: (_room, identity) => {
    calls.push(`joined:${identity}`);
    return Promise.resolve();
  },
  left: (_room, identity) => {
    calls.push(`left:${identity}`);
    return Promise.resolve();
  },
  isResting: () => false,
  monthMinutes: () => 0,
};

const handle = createWebhookHandler({
  receiver: new WebhookReceiver(KEY, SECRET),
  voice,
  meter,
  log: createLogger("silent"),
});

/** Signs a body the way LiveKit does: a JWT from our key whose sha256 claim is the body's hash. */
async function signed(event: string, identity: string, secret = SECRET) {
  const body = JSON.stringify({
    event,
    room: { name: "room-uid" },
    participant: { identity },
    createdAt: "1794571200",
  });
  const token = new AccessToken(KEY, secret);
  token.sha256 = createHash("sha256").update(body).digest("base64");
  return { body, auth: await token.toJwt() };
}

afterEach(() => {
  calls.length = 0;
  voiceGuards.unregister("room-uid");
});

describe("LiveKit webhooks", () => {
  it("refuses a body that isn't signed with our secret, or was changed", async () => {
    const forged = await signed("participant_joined", "asha", "another-secret-long-enough-xx");
    expect(await handle(forged.body, forged.auth)).toBe(401);
    const real = await signed("participant_joined", "asha");
    expect(await handle(real.body.replace("asha", "zed"), real.auth)).toBe(401);
    expect(await handle(real.body, null)).toBe(401);
    expect(calls).toEqual([]);
  });

  it("asks the room again on every join: out, listen only, or welcome; and meters each session", async () => {
    voiceGuards.register("room-uid", (identity) =>
      identity === "kicked" ? "remove" : identity === "blocked" ? "listen" : "ok",
    );
    for (const who of ["kicked", "blocked", "asha"]) {
      const { body, auth } = await signed("participant_joined", who);
      expect(await handle(body, auth)).toBe(200);
    }
    const left = await signed("participant_left", "asha");
    expect(await handle(left.body, left.auth)).toBe(200);
    expect(calls).toEqual([
      "remove:kicked",
      "joined:kicked",
      "block:blocked",
      "joined:blocked",
      "joined:asha",
      "left:asha",
    ]);
  });

  it("over HTTP, then the raw body reaches the signature check", async () => {
    voiceGuards.register("room-uid", () => "ok");
    const server = defineServer({
      transport: new WebSocketTransport(),
      greet: false,
      rooms: {},
      routes: createRouter({ livekitWebhook: webhookEndpoint(handle) }),
    });
    await server.listen(2653);
    try {
      const post = (body: string, auth: string) =>
        fetch("http://localhost:2653/livekit/webhook", {
          method: "POST",
          headers: { authorization: auth, "content-type": "application/webhook+json" },
          body,
        });
      const { body, auth } = await signed("participant_joined", "asha");
      expect((await post(body, auth)).status).toBe(200);
      expect((await post(`${body} `, auth)).status).toBe(401);
      expect(calls).toEqual(["joined:asha"]);
    } finally {
      await server.gracefullyShutdown(false);
    }
  });

  it("when the room no longer exists, then whoever joins its voice is removed", async () => {
    const { body, auth } = await signed("participant_joined", "asha");
    await handle(body, auth);
    expect(calls).toContain("remove:asha");
  });
});
