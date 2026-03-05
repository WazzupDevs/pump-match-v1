import "server-only";
import { getRedisClient } from "@/lib/rate-limiter";
import type { MarketSnapshot } from "@/types";

// Re-export so existing imports from "@/lib/market-data" keep working
export type { MarketSnapshot } from "@/types";

// ──────────────────────────────────────────────────────────────
// V8 Analysis Engine: Market Data Provider (DexScreener)
//
// Fail-safe: every public function returns null/empty on ANY error.
// Caching: Redis (Upstash) with in-memory fallback, 15-min TTL.
// ──────────────────────────────────────────────────────────────

const DEXSCREENER_TIMEOUT_MS = 4000;
const CACHE_TTL_S = 900; // 15 minutes
const REDIS_PREFIX = "pump-match:dex:";
const MAX_MEM_CACHE = 200;

// In-memory fallback cache (dev / Redis unavailable)
const globalForDex = globalThis as unknown as {
  dexCache?: Map<string, { data: MarketSnapshot; expiresAt: number }>;
};
if (!globalForDex.dexCache) {
  globalForDex.dexCache = new Map();
}
const memCache = globalForDex.dexCache;

async function getCached(mint: string): Promise<MarketSnapshot | null> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get<string>(`${REDIS_PREFIX}${mint}`);
      if (raw) return JSON.parse(raw) as MarketSnapshot;
    } catch {
      // fall through
    }
  }
  const entry = memCache.get(mint);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  if (entry) memCache.delete(mint);
  return null;
}

async function setCache(mint: string, snapshot: MarketSnapshot): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.setex(`${REDIS_PREFIX}${mint}`, CACHE_TTL_S, JSON.stringify(snapshot));
      return;
    } catch {
      // fall through
    }
  }
  if (memCache.size >= MAX_MEM_CACHE) {
    const firstKey = memCache.keys().next().value;
    if (firstKey) memCache.delete(firstKey);
  }
  memCache.set(mint, { data: snapshot, expiresAt: Date.now() + CACHE_TTL_S * 1000 });
}

/**
 * Fetch a point-in-time market snapshot for a single token mint via DexScreener.
 * Returns null on ANY error (timeout, network, parse).
 */
export async function getTokenMarketSnapshot(
  mint: string,
): Promise<MarketSnapshot | null> {
  try {
    const cached = await getCached(mint);
    if (cached) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEXSCREENER_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return null;

    const json = await res.json() as {
      pairs?: Array<{
        chainId?: string;
        priceUsd?: string;
        liquidity?: { usd?: number };
        fdv?: number;
      }>;
    };

    const pairs = json.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) return null;

    // Filter Solana pairs, pick highest liquidity
    const solanaPairs = pairs.filter((p) => p.chainId === "solana");
    if (solanaPairs.length === 0) return null;

    const best = solanaPairs.reduce((a, b) =>
      (a.liquidity?.usd ?? 0) >= (b.liquidity?.usd ?? 0) ? a : b,
    );

    const priceUsd = best.priceUsd ? Number(best.priceUsd) : undefined;
    const liquidityUsd = best.liquidity?.usd ?? undefined;
    const fdvUsd = best.fdv ?? undefined;

    const snapshot: MarketSnapshot = {
      mint,
      priceUsd: priceUsd != null && Number.isFinite(priceUsd) ? priceUsd : undefined,
      liquidityUsd: liquidityUsd != null && Number.isFinite(liquidityUsd) ? liquidityUsd : undefined,
      fdvUsd: fdvUsd != null && Number.isFinite(fdvUsd) ? fdvUsd : undefined,
      updatedAt: Date.now(),
    };

    await setCache(mint, snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

/**
 * Batch variant — fetch snapshots for multiple mints in parallel.
 * Uses Promise.allSettled so individual failures don't crash the batch.
 */
export async function getTokenMarketSnapshots(
  mints: string[],
): Promise<Map<string, MarketSnapshot>> {
  if (mints.length === 0) return new Map();

  const results = await Promise.allSettled(
    mints.map((m) => getTokenMarketSnapshot(m)),
  );

  const map = new Map<string, MarketSnapshot>();
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && r.value) {
      map.set(mints[i], r.value);
    }
  }
  return map;
}
