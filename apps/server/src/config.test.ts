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
    expect(parseConfig({})).toMatchObject({ ALLOWED_ORIGINS: ["*"], PORT: 2567 });
  });

  it("when production has no origin list, then refuses to boot", () => {
    expect(() => parseConfig({ NODE_ENV: "production" })).toThrow(/ALLOWED_ORIGINS: required/);
  });

  it("when production allows every origin, then refuses to boot", () => {
    expect(() => parseConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "*" })).toThrow(/wildcard/);
  });
});
