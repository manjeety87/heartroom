import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./origin.ts";

describe("isAllowedOrigin", () => {
  const allowed = ["https://heartroom.app", "http://localhost:3000"];

  it("when the origin is listed exactly, then allows it", () => {
    expect(isAllowedOrigin("http://localhost:3000", allowed)).toBe(true);
  });

  it("when the origin is missing, a look-alike or a different port, then refuses it", () => {
    expect(isAllowedOrigin(null, allowed)).toBe(false);
    expect(isAllowedOrigin("https://heartroom.app.evil.test", allowed)).toBe(false);
    expect(isAllowedOrigin("http://localhost:3001", allowed)).toBe(false);
  });

  it("when the list is a wildcard (development only), then allows anything", () => {
    expect(isAllowedOrigin(null, ["*"])).toBe(true);
  });
});
