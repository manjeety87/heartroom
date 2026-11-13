import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import type { Logger } from "../logger.ts";

/**
 * Room voice through LiveKit (design doc › Voice). The game server is the only holder of the API
 * secret: it mints a short token per person and changes permissions itself, so the browser never
 * holds `roomAdmin`. A voice failure is logged and never throws into the game.
 */
export type Voice = {
  /** False when LiveKit isn't configured: token requests answer VOICE_UNAVAILABLE. */
  readonly isEnabled: boolean;
  /** The wss URL browsers connect to. */
  readonly url: string;
  mintToken(request: TokenRequest): Promise<string>;
  /** Block or allow someone's mic while they are in voice (no-op if they aren't). */
  setCanPublish(room: string, identity: string, canPublish: boolean): Promise<void>;
  /** Drop someone from voice and void every token issued to them before now. */
  remove(room: string, identity: string): Promise<void>;
};

export type TokenRequest = {
  /** The room's internal id (not the join code, which can change). */
  readonly room: string;
  readonly identity: string;
  readonly name: string;
  readonly canPublish: boolean;
};

/**
 * Only limits the first connection: LiveKit refreshes a connected participant's token itself, so a
 * short life costs nothing and makes a leaked token nearly useless.
 */
export const VOICE_TOKEN_TTL_SECONDS = 60;

/**
 * Every flag is set explicitly so a LiveKit default can never widen what a browser may do: audio
 * from the microphone only, and no data channel or metadata, so voice can never carry game messages.
 */
export function permissionFor(canPublish: boolean) {
  return {
    canSubscribe: true,
    canPublish,
    canPublishSources: [TrackSource.MICROPHONE],
    canPublishData: false,
    canUpdateMetadata: false,
    hidden: false,
  };
}

export type VoiceSettings = {
  readonly url: string;
  readonly apiKey: string;
  readonly apiSecret: string;
};

export function createVoice(settings: VoiceSettings | null, log: Logger): Voice {
  if (settings === null) return disabledVoice;
  // The REST API lives on the same host as the WebSocket URL.
  const service = new RoomServiceClient(
    settings.url.replace(/^ws/, "http"),
    settings.apiKey,
    settings.apiSecret,
  );

  /** "Not in voice" (404) is the usual answer and needs no log line; anything else does. */
  const quietly = async (event: string, call: () => Promise<unknown>) => {
    try {
      await call();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status !== 404) log.warn({ event, status }, event);
    }
  };

  return {
    isEnabled: true,
    url: settings.url,
    async mintToken({ room, identity, name, canPublish }) {
      const token = new AccessToken(settings.apiKey, settings.apiSecret, {
        identity,
        name,
        ttl: VOICE_TOKEN_TTL_SECONDS,
      });
      const permission = permissionFor(canPublish);
      token.addGrant({
        room,
        roomJoin: true,
        roomAdmin: false,
        roomCreate: false,
        roomList: false,
        roomRecord: false,
        ingressAdmin: false,
        canSubscribe: permission.canSubscribe,
        canPublish: permission.canPublish,
        canPublishSources: permission.canPublishSources,
        canPublishData: permission.canPublishData,
        canUpdateOwnMetadata: permission.canUpdateMetadata,
        hidden: permission.hidden,
      });
      return token.toJwt();
    },
    setCanPublish(room, identity, canPublish) {
      return quietly("voice_permission_failed", () =>
        service.updateParticipant(room, identity, { permission: permissionFor(canPublish) }),
      );
    },
    remove(room, identity) {
      return quietly("voice_remove_failed", () =>
        service.removeParticipant(room, identity, {
          revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)),
        }),
      );
    },
  };
}

const disabledVoice: Voice = {
  isEnabled: false,
  url: "",
  mintToken: () => Promise.reject(new Error("voice is not configured")),
  setCanPublish: () => Promise.resolve(),
  remove: () => Promise.resolve(),
};
