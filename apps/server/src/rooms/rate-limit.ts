/**
 * In-memory token buckets, one per key (an IP or a user id). A bucket holds `capacity` tokens and
 * refills continuously over `windowMs`, so "10 per minute" allows a burst of 10, then one every 6 s.
 * One process, no Redis (DECISIONS 2026-11-10), so memory is the store; it is bounded by dropping
 * buckets that have refilled completely, which carry no information.
 */
export type RateLimiter = {
  /** Spends one token for `key`; false when the bucket is empty. */
  take(key: string): boolean;
  readonly size: number;
};

type Bucket = { tokens: number; updatedAt: number };

export function createRateLimiter(options: {
  capacity: number;
  windowMs: number;
  now?: () => number;
  /** Above this many keys, full buckets are swept on the next `take`. */
  maxKeys?: number;
}): RateLimiter {
  const { capacity, windowMs, now = Date.now, maxKeys = 10_000 } = options;
  const perMs = capacity / windowMs;
  const buckets = new Map<string, Bucket>();

  const refill = (bucket: Bucket, at: number) => {
    bucket.tokens = Math.min(capacity, bucket.tokens + (at - bucket.updatedAt) * perMs);
    bucket.updatedAt = at;
  };

  const sweep = (at: number) => {
    for (const [key, bucket] of buckets) {
      refill(bucket, at);
      if (bucket.tokens >= capacity) buckets.delete(key);
    }
  };

  return {
    take(key) {
      const at = now();
      if (buckets.size > maxKeys) sweep(at);
      let bucket = buckets.get(key);
      if (bucket === undefined) {
        bucket = { tokens: capacity, updatedAt: at };
        buckets.set(key, bucket);
      } else {
        refill(bucket, at);
      }
      if (bucket.tokens < 1) return false;
      bucket.tokens -= 1;
      return true;
    },
    get size() {
      return buckets.size;
    },
  };
}
