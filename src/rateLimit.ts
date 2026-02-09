interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;

/**
 * Simple in-memory sliding-window rate limiter.
 * Returns true if the request is allowed, false if rate-limited.
 */
export function checkRateLimit(
  service: string,
  limitPerMinute: number | undefined
): boolean {
  if (!limitPerMinute || limitPerMinute <= 0) return true;

  const key = service;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    // Start new window
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (bucket.count >= limitPerMinute) {
    return false;
  }

  bucket.count++;
  return true;
}
