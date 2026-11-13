import { createEndpoint } from "@colyseus/core";
import type { WebhookReceiver } from "livekit-server-sdk";
import type { Logger } from "../logger.ts";
import type { VoiceMeter } from "./usage.ts";
import type { Voice } from "./voice.ts";

/**
 * What a room says about someone who just joined its voice: still welcome, allowed to listen only
 * (mic blocked), or out (banned, left, or the room is gone).
 */
export type VoiceVerdict = "ok" | "listen" | "remove";

/**
 * Live rooms by their internal id (the LiveKit room name). A room registers itself while it exists,
 * so a webhook can ask it about a person without reaching into Colyseus.
 */
const rooms = new Map<string, (identity: string) => VoiceVerdict>();

export const voiceGuards = {
  register(roomUid: string, verdict: (identity: string) => VoiceVerdict) {
    rooms.set(roomUid, verdict);
  },
  unregister(roomUid: string) {
    rooms.delete(roomUid);
  },
  verdict(roomUid: string, identity: string): VoiceVerdict {
    return rooms.get(roomUid)?.(identity) ?? "remove";
  },
};

/** LiveKit's webhook bodies are a few KB; anything far bigger isn't from LiveKit. */
const WEBHOOK_MAX_BYTES = 64 * 1024;

export type WebhookHandler = (body: string, authorization: string | null) => Promise<number>;

/**
 * LiveKit's webhooks (signed with our API secret, body hash inside the JWT). On every join the room
 * is asked again, because a token still within its minute could be reused after a kick or a block:
 * this check, not the token alone, is what makes them hold. Answers an HTTP status.
 */
export function createWebhookHandler({
  receiver,
  voice,
  meter,
  log,
}: {
  readonly receiver: Pick<WebhookReceiver, "receive">;
  readonly voice: Voice;
  readonly meter: VoiceMeter;
  readonly log: Logger;
}): WebhookHandler {
  return async (body, authorization) => {
    let event: Awaited<ReturnType<WebhookReceiver["receive"]>>;
    try {
      event = await receiver.receive(body, authorization ?? undefined);
    } catch {
      log.warn({ event: "voice_webhook_refused" }, "voice_webhook_refused");
      return 401;
    }
    const roomUid = event.room?.name;
    const identity = event.participant?.identity;
    if (roomUid === undefined || identity === undefined) return 200;
    const at = event.createdAt > 0n ? new Date(Number(event.createdAt) * 1000) : new Date();

    switch (event.event) {
      case "participant_joined": {
        const verdict = voiceGuards.verdict(roomUid, identity);
        if (verdict === "remove") {
          await voice.remove(roomUid, identity);
          log.info({ event: "voice_join_refused", userId: identity }, "voice_join_refused");
        } else if (verdict === "listen") {
          await voice.setCanPublish(roomUid, identity, false);
        }
        await meter.joined(roomUid, identity, at);
        return 200;
      }
      case "participant_left":
        await meter.left(roomUid, identity, at);
        return 200;
      default:
        return 200;
    }
  };
}

/** `POST /livekit/webhook`. Answers 404 while voice is off. */
export function webhookEndpoint(onWebhook: WebhookHandler | null) {
  return createEndpoint(
    "/livekit/webhook",
    // The raw body is needed: LiveKit signs its hash.
    { method: "POST", disableBody: true, requireRequest: true },
    async (ctx) => {
      if (onWebhook === null) return new Response(null, { status: 404 });
      const length = Number(ctx.request.headers.get("content-length") ?? 0);
      if (length > WEBHOOK_MAX_BYTES) return new Response(null, { status: 413 });
      const body = await ctx.request.text();
      if (body.length > WEBHOOK_MAX_BYTES) return new Response(null, { status: 413 });
      const status = await onWebhook(body, ctx.request.headers.get("authorization"));
      return new Response(null, { status });
    },
  );
}
