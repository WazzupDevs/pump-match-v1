/**
 * Upstash Redis rate limiter for server actions.
 * Persists across serverless invocations — production-ready.
 *
 * Env vars (required in production):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Fallback: If env vars are not set (local dev), all requests are allowed
 * and a warning is logged. Rate limiting is silently disabled.
 *
 * SECURITY: Prevents Helius API key exhaustion and DB spam attacks.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Pre-configured limits for each action type
export const RATE_LIMITS = {
  // analyzeWallet: 10 requests per 15 minutes per identifier
  ANALYZE_WALLET: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  // joinNetwork: 5 requests per hour per wallet
  JOIN_NETWORK: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  // searchNetwork: 20 requests per minute per IP
  SEARCH_NETWORK: { maxRequests: 20, windowMs: 60 * 1000 },
  // triggerManualSync: 5 requests per 15 minutes per admin wallet
  MANUAL_SYNC: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  // endorseUser: 5 endorsements per day per wallet
  ENDORSE: { maxRequests: 5, windowMs: 24 * 60 * 60 * 1000 },
  // claimProject: 5 claims per minute per wallet+mint combo
  CLAIM: { maxRequests: 5, windowMs: 60 * 1000 },
} as const;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

// Convert milliseconds to Upstash Duration string
function msToUpstashDuration(ms: number): `${number} ${"ms" | "s" | "m" | "h" | "d"}` {
  const hours = ms / (60 * 60 * 1000);
  const mins = ms / (60 * 1000);
  const secs = ms / 1000;
  if (Number.isInteger(hours) && hours >= 1) return `${hours} h`;
  if (Number.isInteger(mins) && mins >= 1) return `${mins} m`;
  if (Number.isInteger(secs) && secs >= 1) return `${secs} s`;
  return `${ms} ms`;
}

let redis: Redis | null = null;
let redisInitAttempted = false;

// Returns Redis instance or null if env vars are not configured.
// Exported so other modules (e.g. analyzeWallet cache) can reuse the same connection.
export function getRedisClient(): Redis | null {
  if (redisInitAttempted) return redis;
  redisInitAttempted = true;

  const url  = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // eslint-disable-next-line no-console
    console.warn("[rate-limiter] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set. Rate limiting disabled.");
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

// Cache Ratelimit instances by config key to avoid re-creation
const ratelimitCache = new Map<string, Ratelimit>();

function getRatelimit(r: Redis, maxRequests: number, windowMs: number): Ratelimit {
  const key = `${maxRequests}:${windowMs}`;
  const cached = ratelimitCache.get(key);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.fixedWindow(maxRequests, msToUpstashDuration(windowMs)),
    prefix: "pump-match:rl",
  });

  ratelimitCache.set(key, limiter);
  return limiter;
}

/**
 * Check if an identifier is within rate limits.
 * Fails open (allows request) if Upstash is not configured.
 *
 * @param identifier - IP address or wallet address
 * @param maxRequests - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const r = getRedisClient();

  // Fail-closed in production: if Redis is not configured, deny all requests.
  // Fail-open only in development/test environments.
  if (!r) {
    if (process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.error('[rate-limiter] Redis not configured in production. Blocking request for safety.');
      return { allowed: false, retryAfterMs: 60_000 };
    }
    return { allowed: true }; // local dev: allow without rate limiting
  }

  const limiter = getRatelimit(r, maxRequests, windowMs);
  const result = await limiter.limit(identifier);

  if (result.success) {
    return { allowed: true };
  }

  const retryAfterMs = Math.max(0, result.reset - Date.now());
  return { allowed: false, retryAfterMs };
}
