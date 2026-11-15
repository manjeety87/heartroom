import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip.ts";

const forwarded = (value: string) => new Headers({ "x-forwarded-for": value });

describe("clientIp", () => {
  it("behind one proxy, trusts only the address that proxy appended", () => {
    // The client wrote "1.1.1.1"; the proxy appended the address it really saw.
    expect(clientIp(forwarded("1.1.1.1, 203.0.113.9"), "1.1.1.1", 1)).toBe("203.0.113.9");
    expect(clientIp(forwarded("203.0.113.9"), undefined, 1)).toBe("203.0.113.9");
  });

  it("behind two proxies, counts two from the right", () => {
    expect(clientIp(forwarded("9.9.9.9, 203.0.113.9, 10.0.0.2"), undefined, 2)).toBe("203.0.113.9");
  });

  it("puts requests that skipped the proxies in one shared bucket", () => {
    expect(clientIp(new Headers(), "1.1.1.1", 1)).toBe("unknown");
    expect(clientIp(undefined, "1.1.1.1", 2)).toBe("unknown");
  });

  it("without a proxy (development), uses Colyseus's address", () => {
    expect(clientIp(forwarded("1.1.1.1"), "127.0.0.1", 0)).toBe("127.0.0.1");
    expect(clientIp(undefined, undefined, 0)).toBe("unknown");
  });
});
