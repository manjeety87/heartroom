import { GAME_JWT } from "@heartroom/protocol";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { createTokenVerifier, type VerifyToken } from "./verify-token.ts";

const signer = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const stranger = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const keys = createLocalJWKSet({
  keys: [{ ...(await exportJWK(signer.publicKey)), kid: "k1", alg: "EdDSA" }],
});

type Claims = { sub?: string; iss?: string; aud?: string; exp?: number | string };

async function token(claims: Claims = {}, key = signer.privateKey) {
  const jwt = new SignJWT({}).setProtectedHeader({ alg: "EdDSA", kid: "k1" });
  jwt.setSubject(claims.sub ?? "user-1");
  jwt.setIssuer(claims.iss ?? GAME_JWT.issuer).setAudience(claims.aud ?? GAME_JWT.audience);
  if (claims.exp !== undefined) jwt.setExpirationTime(claims.exp);
  else jwt.setExpirationTime("5m");
  return jwt.sign(key);
}

describe("createTokenVerifier", () => {
  let dev: VerifyToken;
  let prod: VerifyToken;
  beforeAll(() => {
    dev = createTokenVerifier({ isProduction: false, keys });
    prod = createTokenVerifier({ isProduction: true, keys });
  });

  it("when the site signed a valid token, then names its user", async () => {
    expect(await prod(await token())).toEqual({ userId: "user-1" });
  });

  it("when the token is signed by another key, then refuses it", async () => {
    expect(await prod(await token({}, stranger.privateKey))).toBeNull();
  });

  it("when the issuer or audience is someone else's, then refuses it", async () => {
    expect(await prod(await token({ iss: "elsewhere" }))).toBeNull();
    expect(await prod(await token({ aud: "elsewhere" }))).toBeNull();
  });

  it("when the token expired more than 30 s ago, then refuses it", async () => {
    const now = Math.floor(Date.now() / 1000);
    expect(await prod(await token({ exp: now - 60 }))).toBeNull();
    expect(await prod(await token({ exp: now - 10 }))).toEqual({ userId: "user-1" });
  });

  it("when the token is missing or not a JWT, then refuses it", async () => {
    for (const bad of [undefined, "", "riya", "a.b.c"]) expect(await prod(bad)).toBeNull();
  });

  it("when a dev token is used outside production, then names a dev user", async () => {
    expect(await dev("dev:riya")).toEqual({ userId: "dev-riya" });
    expect(await dev("dev:a b")).toBeNull();
    expect(await dev(`dev:${"x".repeat(65)}`)).toBeNull();
  });

  it("when running in production, then refuses even a well-formed dev token", async () => {
    expect(await prod("dev:riya")).toBeNull();
  });
});
