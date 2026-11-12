import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "./id.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newId", () => {
  it("makes distinct 32-character hex ids", () => {
    const a = newId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newId()).not.toBe(a);
  });

  it("still works where crypto.randomUUID is missing (plain http on a LAN address)", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(newId()).toMatch(/^[0-9a-f]{32}$/);
  });
});
