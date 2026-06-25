/**
 * Fixed-window per-key rate limiter. Pure logic operates on a plain `Map`
 * so it's easily unit-testable; route handlers use the shared singleton
 * store below.
 *
 * Caveat: state is in-memory per server instance, so on Vercel's
 * multi-instance serverless runtime each instance enforces its own limit
 * independently (effective limit scales with instance count). Acceptable
 * for current traffic; revisit with a shared store (e.g. Redis) if abuse
 * becomes an issue at scale.
 */

export interface RateLimitEntry {
  windowStart: number;
  count: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): RateLimitResult {
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { windowStart: now, count: 1 });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count < limit) {
    entry.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  return { allowed: false, retryAfterMs: entry.windowStart + windowMs - now };
}

const globalStore = new Map<string, RateLimitEntry>();

/** Consume one request against the shared in-memory rate limit store. */
export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  return checkRateLimit(globalStore, key, limit, windowMs, Date.now());
}
