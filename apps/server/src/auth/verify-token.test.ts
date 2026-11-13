import { describe, expect, it } from "vitest";
import { verifyToken } from "./verify-token.ts";

const dev = { isProduction: false };

describe("verifyToken", () => {
  it("when a dev token is used in development, then names a dev user", () => {
    expect(verifyToken("dev:riya", dev)).toEqual({ userId: "dev-riya" });
  });

  it("when the token is missing or malformed, then refuses it", () => {
    for (const token of [undefined, "", "riya", "dev:", "dev:a b", `dev:${"x".repeat(65)}`]) {
      expect(verifyToken(token, dev)).toBeNull();
    }
  });

  it("when running in production, then refuses even a well-formed dev token", () => {
    expect(verifyToken("dev:riya", { isProduction: true })).toBeNull();
  });
});
