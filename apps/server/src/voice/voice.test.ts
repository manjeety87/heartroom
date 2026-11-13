import { TokenVerifier } from "livekit-server-sdk";
import { describe, expect, it } from "vitest";
import { createLogger } from "../logger.ts";
import { createVoice, VOICE_TOKEN_TTL_SECONDS } from "./voice.ts";

const settings = {
  url: "wss://example.livekit.cloud",
  apiKey: "test-key",
  apiSecret: "test-secret-that-is-long-enough-for-hs256",
};
const voice = createVoice(settings, createLogger("silent"));
const verifier = new TokenVerifier(settings.apiKey, settings.apiSecret);

const grantOf = async (canPublish: boolean) => {
  const token = await voice.mintToken({
    room: "room-uid",
    identity: "user-1",
    name: "Asha",
    canPublish,
  });
  return verifier.verify(token);
};

describe("voice tokens", () => {
  it("allow one room, mic audio only, no data or admin, and live for a minute", async () => {
    const claims = await grantOf(true);
    expect(claims.sub).toBe("user-1");
    expect(claims.name).toBe("Asha");
    expect((claims.exp ?? 0) - (claims.nbf ?? 0)).toBe(VOICE_TOKEN_TTL_SECONDS);
    expect(claims.video).toMatchObject({
      room: "room-uid",
      roomJoin: true,
      roomAdmin: false,
      roomCreate: false,
      canSubscribe: true,
      canPublish: true,
      canPublishSources: ["microphone"],
      canPublishData: false,
      canUpdateOwnMetadata: false,
    });
  });

  it("when the mic is blocked, then the token can only listen", async () => {
    expect((await grantOf(false)).video).toMatchObject({ canPublish: false, canSubscribe: true });
  });

  it("when LiveKit isn't configured, then voice is off and changes are no-ops", async () => {
    const off = createVoice(null, createLogger("silent"));
    expect(off.isEnabled).toBe(false);
    await expect(off.setCanPublish("r", "u", false)).resolves.toBeUndefined();
    await expect(
      off.mintToken({ room: "r", identity: "u", name: "n", canPublish: true }),
    ).rejects.toThrow();
  });
});
