import { describe, expect, it } from "vitest";
import { parseConfig } from "./config.ts";

describe("parseConfig", () => {
  it("when only the required names are set, then fills the defaults", () => {
    const config = parseConfig({ ALLOWED_ORIGINS: "http://localhost:3000" });
    expect(config).toMatchObject({ PORT: 2567, LOG_LEVEL: "info", isProduction: false });
    expect(config.ALLOWED_ORIGINS).toEqual(["http://localhost:3000"]);
  });

  it("when a list has spaces and empty items, then trims them", () => {
    const config = parseConfig({ ALLOWED_ORIGINS: " http://a.test , ,http://b.test" });
    expect(config.ALLOWED_ORIGINS).toEqual(["http://a.test", "http://b.test"]);
  });

  it("when a value is empty, then treats it as unset", () => {
    expect(parseConfig({ ALLOWED_ORIGINS: "*", PORT: "" }).PORT).toBe(2567);
  });

  it("when a value is wrong, then names the variable but never echoes the value", () => {
    const run = () => parseConfig({ ALLOWED_ORIGINS: "not-a-url-secret" });
    expect(run).toThrow(/ALLOWED_ORIGINS/);
    expect(run).not.toThrow(/not-a-url-secret/);
  });

  it("when nothing is set in development, then boots and allows every origin", () => {
    expect(parseConfig({})).toMatchObject({
      ALLOWED_ORIGINS: ["*"],
      PORT: 2567,
      AUTH_JWKS_URL: "http://localhost:3000/api/auth/jwks",
    });
  });

  it("when LiveKit is set, then voice is on; half-set refuses to boot; the kill switch turns it off", () => {
    const livekit = {
      LIVEKIT_URL: "wss://x.livekit.cloud",
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
    };
    expect(parseConfig({}).voice).toBeNull();
    expect(parseConfig(livekit).voice).toEqual({
      url: "wss://x.livekit.cloud",
      apiKey: "key",
      apiSecret: "secret",
    });
    expect(parseConfig({ ...livekit, VOICE_ENABLED: "false" }).voice).toBeNull();
    expect(() => parseConfig({ LIVEKIT_URL: "wss://x.livekit.cloud" })).toThrow(
      /LIVEKIT_API_KEY: set all three/,
    );
  });

  it("when production has no origin list, then refuses to boot", () => {
    expect(() => parseConfig({ NODE_ENV: "production" })).toThrow(/ALLOWED_ORIGINS: required/);
  });

  it("when production allows every origin, then refuses to boot", () => {
    expect(() => parseConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "*" })).toThrow(/wildcard/);
  });

  it("when production has no JWKS URL, then refuses to boot", () => {
    const env = {
      NODE_ENV: "production",
      ALLOWED_ORIGINS: "https://heartroom.test",
      CHECKPOINT_KEY: Buffer.alloc(32, 7).toString("base64"),
      DATABASE_URL: "postgres://u:p@db.heartroom.test/heartroom",
    } as const;
    expect(() => parseConfig(env)).toThrow(/AUTH_JWKS_URL: required/);
    const withKeys = { ...env, AUTH_JWKS_URL: "https://heartroom.test/api/auth/jwks" };
    expect(parseConfig(withKeys).AUTH_JWKS_URL).toBe("https://heartroom.test/api/auth/jwks");
  });

  it("when the checkpoint key is missing in production or not 32 bytes, then refuses to boot", () => {
    expect(() => parseConfig({ NODE_ENV: "production" })).toThrow(/CHECKPOINT_KEY: required/);
    const short = Buffer.alloc(16, 1).toString("base64");
    expect(() => parseConfig({ CHECKPOINT_KEY: short })).toThrow(/CHECKPOINT_KEY: must be base64/);
    expect(parseConfig({}).CHECKPOINT_KEY).toHaveLength(32);
  });

  it("when production has no database URL, then refuses to boot; development uses the local one", () => {
    expect(() => parseConfig({ NODE_ENV: "production" })).toThrow(/DATABASE_URL: required/);
    expect(parseConfig({}).DATABASE_URL).toMatch(/^postgres:\/\/.*127\.0\.0\.1:5433/);
  });
});
