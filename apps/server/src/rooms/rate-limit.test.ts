import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit.ts";

const clock = () => {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe("createRateLimiter", () => {
  it("when a key uses its burst, then the next try is refused", () => {
    const limiter = createRateLimiter({ capacity: 10, windowMs: 60_000, now: clock().now });
    const results = Array.from({ length: 11 }, () => limiter.take("1.2.3.4"));
    expect(results.filter(Boolean)).toHaveLength(10);
    expect(results.at(-1)).toBe(false);
  });

  it("when time passes, then tokens come back at the window's rate", () => {
    const time = clock();
    const limiter = createRateLimiter({ capacity: 10, windowMs: 60_000, now: time.now });
    for (let i = 0; i < 10; i++) limiter.take("ip");
    time.advance(5_999);
    expect(limiter.take("ip")).toBe(false);
    time.advance(1);
    expect(limiter.take("ip")).toBe(true);
  });

  it("when one key is limited, then other keys are not", () => {
    const limiter = createRateLimiter({ capacity: 1, windowMs: 60_000, now: clock().now });
    limiter.take("a");
    expect(limiter.take("a")).toBe(false);
    expect(limiter.take("b")).toBe(true);
  });

  it("when many keys pile up, then full buckets are dropped and limited ones kept", () => {
    const time = clock();
    const limiter = createRateLimiter({ capacity: 2, windowMs: 1_000, now: time.now, maxKeys: 3 });
    limiter.take("busy");
    limiter.take("busy");
    for (const key of ["a", "b", "c"]) limiter.take(key);
    time.advance(500);
    limiter.take("d");
    expect(limiter.size).toBe(2);
    expect(limiter.take("busy")).toBe(true);
    expect(limiter.take("busy")).toBe(false);
  });
});
