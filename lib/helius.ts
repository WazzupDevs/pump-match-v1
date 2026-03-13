import "server-only";
import type { ConfidenceLevel, PumpStats, VenueId, VenueOverlay } from "@/types";

// SECURITY: Server-only API key. NEVER use NEXT_PUBLIC_ prefix for Helius key —
// that would expose it to the browser bundle and allow API abuse.
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

if (!HELIUS_API_KEY || typeof HELIUS_API_KEY !== "string" || HELIUS_API_KEY.trim().length === 0) {
  // eslint-disable-next-line no-console
  console.warn("⚠️ HELIUS_API_KEY is not set or invalid. Helius calls will fail.");
}

const HELIUS_RPC_URL = HELIUS_API_KEY
  ? `https://beta.helius-rpc.com/?api-key=${HELIUS_API_KEY.trim()}`
  : null;

// Helius Enhanced Transactions API (Gatekeeper Beta)
const HELIUS_API_BASE = "https://beta.helius-rpc.com";

// Types
type JsonRpcError = {
  code: number;
  message: string;
};

type JsonRpcResponse<T> = {
  result?: T;
  error?: JsonRpcError;
};

export type DasAsset = {
  id: string;
  interface?: string;
  [key: string]: unknown;
};

export type SearchAssetsResult = {
  items: DasAsset[];
  total?: number;
  assets?: {
    total?: number;
    limit?: number;
    page?: number;
    items?: DasAsset[];
  };
};

export type GetAssetsByOwnerResult = {
  items: DasAsset[];
  total?: number;
};

export type SearchAssetsParams = {
  ownerAddress?: string;
  tokenType?: "all" | "fungible" | "nonFungible";
  page?: number;
  limit?: number;
};

// ──────────────────────────────────────────────────────────────
// Helius Enhanced Transactions API Types (v0 REST endpoint)
// Returns pre-parsed transactions — no N+1 signature lookup needed.
// ──────────────────────────────────────────────────────────────

export type EnhancedTransaction = {
  description: string;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  signature: string;
  slot: number;
  timestamp: number;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount: string;
    toTokenAccount: string;
    tokenAmount: number;
    mint: string;
    tokenStandard?: string;
  }>;
  accountData?: Array<{
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges: unknown[];
  }>;
  events?: Record<string, unknown>;
};

const MAX_RETRIES = 3;

/**
 * Centralized RPC caller with robust error handling and exponential backoff.
 * Retries on 429 (rate limit) and 5xx (server error). Returns null on error.
 */
async function callHeliusRpc<T>(method: string, params: unknown): Promise<T | null> {
  if (!HELIUS_RPC_URL) {
    // eslint-disable-next-line no-console
    console.error(`[Helius RPC] RPC URL not configured. Cannot call ${method}`);
    return null;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(HELIUS_RPC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: method,
          method,
          params,
        }),
      });

      if (response.ok) {
        const json = (await response.json()) as JsonRpcResponse<T>;

        if (json.error) {
          // eslint-disable-next-line no-console
          console.error(`[Helius RPC] Error response for ${method}:`, json.error);
          return null;
        }

        if (!json.result) {
          // eslint-disable-next-line no-console
          console.error(`[Helius RPC] Missing result for ${method}`);
          return null;
        }

        return json.result;
      }

      // Rate limit — respect Retry-After header or exponential backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
        // eslint-disable-next-line no-console
        console.warn(`[Helius RPC] 429 for ${method}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }

      // Server error — exponential backoff
      if (response.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000;
        // eslint-disable-next-line no-console
        console.warn(`[Helius RPC] ${response.status} for ${method}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }

      // Client error (400, 401, etc.) — do not retry
      const errorText = await response.text();
      // eslint-disable-next-line no-console
      console.error(`[Helius RPC] Request failed for ${method}:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 200),
      });
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[Helius RPC] Exception calling ${method} (attempt ${attempt + 1}/${MAX_RETRIES}):`, {
        message: error instanceof Error ? error.message : String(error),
      });
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((res) => setTimeout(res, Math.pow(2, attempt) * 1000));
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Helius DAS searchAssets wrapper.
 * Uses limit: 1 to fetch only metadata (total count), not the full list.
 * Returns null on error.
 */
export async function searchAssets(params: SearchAssetsParams): Promise<SearchAssetsResult | null> {
  try {
    const result = await callHeliusRpc<SearchAssetsResult>("searchAssets", params);
    if (!result) {
      return null;
    }
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[searchAssets] Exception:`, error);
    return null;
  }
}

/**
 * Helius DAS getAssetsByOwner wrapper.
 * Production Grade: Whale Illusion Fix - uses limit: 1000 to get accurate asset counts.
 * Without high limit, whales with 100+ assets appear as small wallets.
 * Returns null on error.
 */
export async function getAssetsByOwner(
  ownerAddress: string,
  options?: { page?: number; limit?: number },
): Promise<GetAssetsByOwnerResult | null> {
  try {
    const params = {
      ownerAddress,
      page: options?.page ?? 1,
      limit: options?.limit ?? 1000, // Whale Illusion Fix: high limit for accurate counts
    };
    const result = await callHeliusRpc<GetAssetsByOwnerResult>("getAssetsByOwner", params);
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[getAssetsByOwner] Exception:`, error);
    return null;
  }
}

/**
 * Fetch SOL balance (in SOL) for a wallet using Helius RPC getBalance.
 * Returns 0 on error.
 */
export async function getSolBalance(address: string): Promise<number> {
  try {
    type GetBalanceResult = {
      context: { slot: number };
      value: number; // lamports
    };

    const result = await callHeliusRpc<GetBalanceResult>("getBalance", [address]);
    if (!result) {
      return 0;
    }

    const sol = result.value / 1_000_000_000;
    return Number.isFinite(sol) && sol >= 0 ? sol : 0;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[getSolBalance] Exception for ${address}:`, error);
    return 0;
  }
}

// ──────────────────────────────────────────────────────────────
// Helius DAS getAsset — Single Asset Lookup (Arena Truth Gate)
// ──────────────────────────────────────────────────────────────

export type HeliusAssetInfo = {
  id: string;
  interface: string;
  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
      update_authority?: string;
    };
  };
  token_info?: {
    supply?: number;
    decimals?: number;
    price_info?: {
      price_per_token?: number;
      total_price?: number;
    };
  };
  authorities?: Array<{
    address: string;
    scopes: string[];
  }>;
};

/**
 * Helius DAS getAsset — Fetch a single asset by mint address.
 * Used by the Arena engine to verify on-chain token existence and metadata.
 * Returns null on error.
 */
export async function getAsset(mintAddress: string): Promise<HeliusAssetInfo | null> {
  try {
    const result = await callHeliusRpc<HeliusAssetInfo>("getAsset", { id: mintAddress });
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[getAsset] Exception for ${mintAddress}:`, error);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// Helius Wallet Balances API (Beta) — Portfolio USD Value
//
// GET /v1/wallet/{address}/balances
// Returns totalUsdValue aggregated across all priced tokens.
// Pricing covers top 10K tokens by market cap, updated hourly.
//
// Return contract:
//   { ok: true, balances }  — success
//   { ok: false, reason }   — non-fatal classified failure
//   throws                  — 5xx / network timeout (caller must handle)
// ──────────────────────────────────────────────────────────────

export type WalletBalances = { totalUsdValue: number };

export type WalletBalancesResult =
  | { ok: true; balances: WalletBalances }
  | { ok: false; reason: "not_found" | "rate_limited" };

const WALLET_BALANCES_TIMEOUT_MS = 8000;

export async function getWalletBalances(
  address: string,
): Promise<WalletBalancesResult> {
  const apiKey = HELIUS_API_KEY;
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn("[getWalletBalances] HELIUS_API_KEY not configured.");
    return { ok: false, reason: "not_found" };
  }

  const url = new URL(
    `${HELIUS_API_BASE}/v1/wallet/${address}/balances`,
  );
  url.searchParams.set("limit", "1");
  url.searchParams.set("showNfts", "false");
  url.searchParams.set("showZeroBalance", "false");
  url.searchParams.set("showNative", "true");

  let lastFailureMode: "rate_limited" | "server_error" = "rate_limited";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Recreate AbortController per attempt so retries get a fresh signal
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WALLET_BALANCES_TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "X-Api-Key": apiKey.trim() },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = (await res.json()) as { totalUsdValue?: unknown };

        const total =
          typeof json.totalUsdValue === "number"
            ? json.totalUsdValue
            : Number(json.totalUsdValue);

        if (!Number.isFinite(total)) return { ok: false, reason: "not_found" };

        // 0 is a valid portfolio value (empty wallet)
        return { ok: true, balances: { totalUsdValue: total } };
      }

      // 404 → wallet has no balance data or endpoint miss (non-fatal)
      if (res.status === 404) {
        // eslint-disable-next-line no-console
        console.warn(`[getWalletBalances] 404 for ${address.slice(0, 8)}… — no balance data`);
        return { ok: false, reason: "not_found" };
      }

      // 429 → rate limit — retry with backoff, then return typed failure
      if (res.status === 429) {
        lastFailureMode = "rate_limited";
        const retryAfter = res.headers.get("Retry-After");
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
        // eslint-disable-next-line no-console
        console.warn(`[getWalletBalances] 429, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // 5xx → upstream failure — retry, then throw after exhaustion
      if (res.status >= 500) {
        lastFailureMode = "server_error";
        const delay = Math.pow(2, attempt) * 1000;
        // eslint-disable-next-line no-console
        console.error(`[getWalletBalances] ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Other client errors (400, 401, etc.) — non-fatal, do not retry
      // eslint-disable-next-line no-console
      console.warn(`[getWalletBalances] HTTP ${res.status} for ${address.slice(0, 8)}…`);
      return { ok: false, reason: "not_found" };
    } catch (error) {
      clearTimeout(timeout);
      // eslint-disable-next-line no-console
      console.error(`[getWalletBalances] Exception (attempt ${attempt + 1}/${MAX_RETRIES}):`, error instanceof Error ? error.message : String(error));
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      // Network timeout or persistent failure — throw to signal hard error
      throw error;
    }
  }

  // All retries exhausted — distinguish 429 exhaustion from 5xx exhaustion
  if (lastFailureMode === "server_error") {
    throw new Error(
      `[getWalletBalances] Upstream server error after ${MAX_RETRIES} retries for ${address.slice(0, 8)}…`,
    );
  }

  // eslint-disable-next-line no-console
  console.warn(`[getWalletBalances] Rate limited after ${MAX_RETRIES} retries for ${address.slice(0, 8)}…`);
  return { ok: false, reason: "rate_limited" };
}

// ──────────────────────────────────────────────────────────────
// Helius Enhanced Transactions API — Unified Transaction Fetcher
// Replaces the old N+1 pattern:
//   OLD: getSignaturesForAddress → loop getParsedTransaction
//   NEW: Single v0/addresses/{addr}/transactions call (paginated)
//
// Benefits:
//   - Pre-parsed EnhancedTransaction objects (no separate getTransaction call)
//   - Funding source detection from nativeTransfers (no extra RPC round-trip)
//   - Transaction count + wallet age + funding source in ONE flow
// ──────────────────────────────────────────────────────────────

/**
 * Internal: Fetch a single page of enhanced transactions from Helius v0 REST API.
 * Returns enriched transaction objects directly — no N+1 signature lookup needed.
 * Max 100 per page (Helius API limit).
 */
async function fetchEnhancedTransactionPage(
  address: string,
  options?: { limit?: number; before?: string },
): Promise<EnhancedTransaction[]> {
  const apiKey = HELIUS_API_KEY;
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.error("[Helius Enhanced API] API key not configured.");
    return [];
  }

  const limit = Math.min(options?.limit ?? 100, 100);
  const url = new URL(
    `${HELIUS_API_BASE}/v0/addresses/${address}/transactions`,
  );
  url.searchParams.set("api-key", apiKey.trim());
  url.searchParams.set("limit", String(limit));
  if (options?.before) {
    url.searchParams.set("before", options.before);
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url.toString());

      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? (data as EnhancedTransaction[]) : [];
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
        // eslint-disable-next-line no-console
        console.warn(`[Helius Enhanced API] 429, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }

      if (response.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000;
        // eslint-disable-next-line no-console
        console.warn(`[Helius Enhanced API] ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }

      // Client error — do not retry
      const errorText = await response.text();
      // eslint-disable-next-line no-console
      console.error(`[Helius Enhanced API] HTTP ${response.status}:`, errorText.substring(0, 200));
      return [];
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[Helius Enhanced API] Exception (attempt ${attempt + 1}/${MAX_RETRIES}):`, error instanceof Error ? error.message : String(error));
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((res) => setTimeout(res, Math.pow(2, attempt) * 1000));
        continue;
      }
      return [];
    }
  }

  return [];
}

const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const PUMP_FUN_EPOCH_SEC = 1704067200; // 2024-01-01 UTC, seconds
const WSOL_MINT = "So11111111111111111111111111111111111111112";

// Maps Helius Enhanced Transaction `source` field values to canonical venue IDs.
// Source tags not listed here fall back to OTHER.
const KNOWN_VENUE_SOURCES: Record<string, VenueId> = {
  PUMP_FUN: "PUMP_FUN",
  JUPITER: "JUPITER",
  RAYDIUM: "RAYDIUM",
  METEORA: "METEORA",
  ORCA: "ORCA",
};
const MIN_TXS_FOR_CONFIDENT_VENUE = 5;
const MIN_SHARE_FOR_CONFIDENT_VENUE = 0.40;

/**
 * Derives venue/protocol execution overlay from already-fetched Enhanced Transactions.
 * Detection order:
 *   1. Pump.fun: isPumpTx() program-ID inspection (Helius source is unreliable for pump.fun)
 *   2. All others: Helius `source` field (reliable for Jupiter/Raydium/Meteora/Orca)
 *   3. Fallback: OTHER
 * Only counts token-involving transactions where the wallet is sender or receiver.
 * Additive overlay — must never feed canonical axes or confidence.
 */
function computeVenueOverlay(
  address: string,
  txs: EnhancedTransaction[],
): VenueOverlay {
  const counts: Record<VenueId, number> = {
    PUMP_FUN: 0,
    JUPITER: 0,
    RAYDIUM: 0,
    METEORA: 0,
    ORCA: 0,
    OTHER: 0,
  };
  let totalVenuedTxs = 0;

  for (const tx of txs) {
    const isWalletTokenTx = tx.tokenTransfers?.some(
      (tr) => tr?.fromUserAccount === address || tr?.toUserAccount === address,
    );
    if (!isWalletTokenTx) continue;
    totalVenuedTxs++;
    // Pump.fun: use program-ID inspection first — Helius sometimes returns source:"UNKNOWN"
    // for pump.fun transactions, causing them to be miscounted as OTHER.
    if (isPumpTx(tx)) {
      counts.PUMP_FUN++;
      continue;
    }
    const venueId = KNOWN_VENUE_SOURCES[(tx.source ?? "").toUpperCase()] ?? "OTHER";
    counts[venueId]++;
  }

  if (totalVenuedTxs === 0) {
    return { dominantVenue: null, dominantVenueConfident: false, venueBreakdown: counts, totalVenuedTxs: 0 };
  }

  let maxCount = 0;
  let dominant: VenueId = "OTHER";
  for (const venue of Object.keys(counts) as VenueId[]) {
    if (counts[venue] > maxCount) {
      maxCount = counts[venue];
      dominant = venue;
    }
  }

  const dominantVenueConfident =
    maxCount >= MIN_TXS_FOR_CONFIDENT_VENUE &&
    maxCount / totalVenuedTxs >= MIN_SHARE_FOR_CONFIDENT_VENUE;

  return { dominantVenue: dominant, dominantVenueConfident, venueBreakdown: counts, totalVenuedTxs };
}

// Zaman Birimi Zırhı (Helius bazen ms, bazen sec dönebilir)
function toSec(ts: number): number {
  return ts > 1_000_000_000_000 ? Math.floor(ts / 1000) : ts;
}

function isPumpTx(tx: EnhancedTransaction): boolean {
  type TxWithIx = EnhancedTransaction & {
    instructions?: Array<{ programId: string; innerInstructions?: Array<{ programId: string }> }>;
    innerInstructions?: Array<{ programId: string }>;
  };
  const txAny = tx as TxWithIx;
  for (const ix of txAny.instructions ?? []) {
    if (ix.programId === PUMP_FUN_PROGRAM_ID) return true;
    for (const inner of (ix as { innerInstructions?: Array<{ programId: string }> }).innerInstructions ?? []) {
      if (inner.programId === PUMP_FUN_PROGRAM_ID) return true;
    }
  }
  for (const inner of txAny.innerInstructions ?? []) {
    if (inner.programId === PUMP_FUN_PROGRAM_ID) return true;
  }
  return false;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function jeetScoreFromMedianHold(holdSec: number): number {
  if (holdSec <= 120) return 100;
  if (holdSec <= 300) return 90;
  if (holdSec <= 900) return 75;
  if (holdSec <= 3600) return 50;
  if (holdSec <= 14400) return 30;
  if (holdSec <= 86400) return 10;
  return 0;
}

type PositionState = {
  balance: number;
  openTs: number | null;
  everPump: boolean;
};

const EPSILON = 1e-9;

// 🔥 Saf Simülasyon Motoru (Hatalı Tokenları Eler)
function simulatePump(
  address: string,
  txs: EnhancedTransaction[],
  pumpUniverse: Set<string>,
) {
  const states = new Map<string, PositionState>();
  const holds: number[] = [];
  let closedPositions = 0;

  const chronological = [...txs].reverse(); // oldest -> newest

  for (const tx of chronological) {
    const tsRaw = tx.timestamp;
    if (!tsRaw || !tx.tokenTransfers?.length) continue;

    const ts = toSec(tsRaw);
    const pumpTx = isPumpTx(tx);

    for (const tr of tx.tokenTransfers) {
      const mint = tr?.mint;
      if (!mint || mint === WSOL_MINT) continue; // WSOL is never a pump token

      // ✅ KRİTİK DÜZELTME: Sadece gerçek pump ekosistemi, mint.endsWith("pump") FALAN YOK!
      const isPumpMint = pumpTx || pumpUniverse.has(mint);
      if (!isPumpMint) continue;

      const amt = Number(tr.tokenAmount ?? 0);
      if (!Number.isFinite(amt) || amt === 0) continue;

      const delta =
        tr.toUserAccount === address ? amt :
        tr.fromUserAccount === address ? -amt :
        0;

      if (delta === 0) continue;

      const st = states.get(mint) ?? { balance: 0, openTs: null, everPump: false };
      if (pumpTx) st.everPump = true;

      const prevBal = st.balance;
      const nextBal = prevBal + delta;

      if (prevBal <= EPSILON && nextBal > EPSILON) st.openTs = ts;

      if (prevBal > EPSILON && nextBal <= EPSILON && st.openTs != null) {
        holds.push(Math.max(0, ts - st.openTs));
        closedPositions++;
        st.openTs = null;
      }

      st.balance = nextBal <= EPSILON ? 0 : nextBal;
      states.set(mint, st);
    }
  }

  // Açık pozisyonları ve ölü çantaları (dead bags) hesapla
  const nowSec = Math.floor(Date.now() / 1000);
  let dead = 0;
  let pumpMintsTouched = 0;

  for (const [mint, st] of states.entries()) {
    // Sadece kanıtlanmış tokenları say
    const counted = st.everPump || pumpUniverse.has(mint);
    if (!counted) continue;

    pumpMintsTouched++;

    if (st.openTs != null) {
      const hold = Math.max(0, nowSec - st.openTs);
      // Open positions excluded from holds[] — median must reflect closed exits only
      if (hold > 3 * 24 * 60 * 60) dead++; // 3 günden eskiyse ölü
    }
  }

  return { holds, closedPositions, pumpMintsTouched, dead };
}

/**
 * General-purpose position lifecycle simulation.
 * Tracks ALL token transfers (not just pump.fun) to compute realistic
 * hold durations across the wallet's full trading activity.
 * Uses the same entry/exit state machine as simulatePump but without
 * the pump.fun mint filter.
 */
// Positions closed in < 1 hour are counted as "fast closes" — aligns with VERY_SHORT hold tier.
const FAST_CLOSE_THRESHOLD_SEC = 3600;

// Transaction types representing non-directional protocol mechanics.
// Skipping these prevents LP/vault operations from inflating lifecycle stats
// (re-entry count, unique mints, fast-close count, churn rate).
const NON_DIRECTIONAL_TX_TYPES = new Set([
  "ADD_LIQUIDITY",
  "REMOVE_LIQUIDITY",
  "CREATE_POOL",
]);

function simulateGeneralHolds(
  address: string,
  txs: EnhancedTransaction[],
): { holds: number[]; closedPositions: number; uniqueMints: number; exitedUniqueMints: number; reEntryCount: number; fastCloseCount: number; directionalTxCount: number } {
  const states = new Map<string, { balance: number; openTs: number | null; cycleCount: number }>();
  const touchedMints = new Set<string>();
  const exitedMints = new Set<string>();
  const holds: number[] = [];
  let closedPositions = 0;
  let reEntryCount = 0;
  let fastCloseCount = 0;
  let directionalTxCount = 0;

  const chronological = [...txs].reverse();

  for (const tx of chronological) {
    const tsRaw = tx.timestamp;
    if (!tsRaw || !tx.tokenTransfers?.length) continue;

    // Skip LP and pool-creation transactions — these produce balance transitions
    // that resemble lifecycle events but represent protocol mechanics, not directional trades.
    if (NON_DIRECTIONAL_TX_TYPES.has((tx.type ?? "").toUpperCase())) continue;

    const ts = toSec(tsRaw);
    let txHasWalletDelta = false;

    for (const tr of tx.tokenTransfers) {
      const mint = tr?.mint;
      if (!mint || mint === WSOL_MINT) continue;

      const amt = Number(tr.tokenAmount ?? 0);
      if (!Number.isFinite(amt) || amt === 0) continue;

      const delta =
        tr.toUserAccount === address ? amt :
        tr.fromUserAccount === address ? -amt :
        0;

      if (delta === 0) continue;

      txHasWalletDelta = true;
      touchedMints.add(mint);

      const st = states.get(mint) ?? { balance: 0, openTs: null, cycleCount: 0 };
      const prevBal = st.balance;
      const nextBal = prevBal + delta;

      // Entry: balance crosses zero → positive
      if (prevBal <= EPSILON && nextBal > EPSILON) {
        if (st.cycleCount >= 1) reEntryCount++; // wallet returned to this mint after a full exit
        st.openTs = ts;
      }

      // Exit: balance crosses positive → zero
      if (prevBal > EPSILON && nextBal <= EPSILON && st.openTs != null) {
        const holdDuration = Math.max(0, ts - st.openTs);
        holds.push(holdDuration);
        closedPositions++;
        exitedMints.add(mint); // track unique mints with at least one confirmed closed cycle
        if (holdDuration < FAST_CLOSE_THRESHOLD_SEC) fastCloseCount++;
        st.cycleCount++;
        st.openTs = null;
      }

      st.balance = nextBal <= EPSILON ? 0 : nextBal;
      states.set(mint, st);
    }

    if (txHasWalletDelta) directionalTxCount++;
  }

  return { holds, closedPositions, uniqueMints: touchedMints.size, exitedUniqueMints: exitedMints.size, reEntryCount, fastCloseCount, directionalTxCount };
}

// 🚀 Zırhlanmış Ana Veri Çekme Fonksiyonu
export async function getWalletTransactionData(address: string): Promise<{
  transactionCount: number;
  firstTxSignature: string | null;
  firstTxBlockTime: number | null;
  approxWalletAgeDays: number | null;
  pumpStats: PumpStats | null;
  generalMedianHoldTimeSeconds: number | null;
  generalClosedPositions: number | null;
  generalUniqueMintsTraded: number | null;
  generalExitedUniqueMintsTraded: number | null;
  generalReEntryCount: number | null;
  generalFastCloseCount: number | null;
  generalDirectionalTxCount: number | null;
  venueOverlay: VenueOverlay | null;
}> {
  try {
    const all: EnhancedTransaction[] = [];
    const MAX_PAGES = 5;
    const PAGE_SIZE = 100;

    const EARLY_STOP_PAGES = 2;       // 200 tx
    const CLOSED_POS_TARGET = 30;     // Stat sufficiency
    const LOOKBACK_DAYS = 180;
    const lookbackEpochSec = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 86400;

    let cursor: string | undefined;
    let pumpTxCountSoFar = 0;
    let tokenTxCount = 0;
    const pumpUniverse = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await fetchEnhancedTransactionPage(address, { limit: PAGE_SIZE, before: cursor });
      if (!batch.length) break;

      all.push(...batch);

      // pump universe + pump tx counter + general token tx counter
      for (const tx of batch) {
        if (!tx.tokenTransfers?.length) continue;
        tokenTxCount++;
        if (isPumpTx(tx)) {
          pumpTxCountSoFar++;
          for (const tr of tx.tokenTransfers) {
            if (tr?.mint && tr.mint !== WSOL_MINT && (tr.toUserAccount === address || tr.fromUserAccount === address)) {
              pumpUniverse.add(tr.mint);
            }
          }
        }
      }

      const oldestTxInBatch = batch[batch.length - 1];
      cursor = oldestTxInBatch?.signature;

      // 1) Time-based cutoff: don't fetch beyond the lookback window
      const oldestTsRaw = oldestTxInBatch?.timestamp;
      if (oldestTsRaw) {
        const oldestSec = toSec(oldestTsRaw);
        if (oldestSec < lookbackEpochSec) break;
      }

      // 2) Relevance early stop: no token-involving txs after EARLY_STOP_PAGES → not a token trader
      if (page === EARLY_STOP_PAGES - 1 && tokenTxCount === 0) break;

      // 3) Stat sufficiency: stop when enough closed positions (pump or general)
      if (page >= 1) {
        let sufficient = false;
        if (pumpTxCountSoFar > 0) {
          const sim = simulatePump(address, all, pumpUniverse);
          if (sim.closedPositions >= CLOSED_POS_TARGET) sufficient = true;
        }
        if (!sufficient) {
          const genSim = simulateGeneralHolds(address, all);
          if (genSim.closedPositions >= CLOSED_POS_TARGET) sufficient = true;
        }
        if (sufficient) break;
      }

      if (batch.length < PAGE_SIZE) break;
    }

    const transactionCount = all.length;
    if (transactionCount === 0) {
      return { transactionCount: 0, firstTxSignature: null, firstTxBlockTime: null, approxWalletAgeDays: null, pumpStats: null, generalMedianHoldTimeSeconds: null, generalClosedPositions: null, generalUniqueMintsTraded: null, generalExitedUniqueMintsTraded: null, generalReEntryCount: null, generalFastCloseCount: null, generalDirectionalTxCount: null, venueOverlay: null };
    }

    const oldest = all[all.length - 1];
    const firstTxSignature = oldest.signature ?? null;
    const firstTxBlockTime = oldest.timestamp ?? null;
    const firstTxSec = firstTxBlockTime != null ? toSec(firstTxBlockTime) : null;
    const approxWalletAgeDays = firstTxSec != null ? Math.floor((Date.now() - firstTxSec * 1000) / 86400000) : null;

    // General lifecycle: compute hold durations across ALL token trades (not just pump.fun)
    const generalSim = simulateGeneralHolds(address, all);
    const generalMedianHoldTimeSeconds = generalSim.closedPositions > 0
      ? Math.round(median(generalSim.holds))
      : null;
    const generalClosedPositions = generalSim.closedPositions > 0
      ? generalSim.closedPositions
      : null;
    const generalUniqueMintsTraded = generalSim.uniqueMints > 0 ? generalSim.uniqueMints : null;
    // Unique mints with at least one confirmed exit cycle — the correct breadth basis for churn/narrative signals.
    // Unlike generalClosedPositions (cycle count), this deduplicates repeated cycles on the same mint.
    // Unlike generalUniqueMintsTraded (entry OR exit), this excludes airdrop-receipt-only mints.
    const generalExitedUniqueMintsTraded = generalSim.exitedUniqueMints > 0 ? generalSim.exitedUniqueMints : null;
    // Only surface re-entry and fast-close counts when at least one closed position exists.
    const generalReEntryCount = generalSim.closedPositions > 0 ? generalSim.reEntryCount : null;
    const generalFastCloseCount = generalSim.closedPositions > 0 ? generalSim.fastCloseCount : null;
    // Always surface directional tx count when we have tx data — zero is meaningful (all LP wallet).
    const generalDirectionalTxCount = generalSim.directionalTxCount;

    // Venue overlay: derived from Helius `source` field on already-fetched txs. Zero new API calls.
    const venueOverlay = computeVenueOverlay(address, all);

    if (pumpTxCountSoFar === 0) {
      return { transactionCount, firstTxSignature, firstTxBlockTime, approxWalletAgeDays, pumpStats: null, generalMedianHoldTimeSeconds, generalClosedPositions, generalUniqueMintsTraded, generalExitedUniqueMintsTraded, generalReEntryCount, generalFastCloseCount, generalDirectionalTxCount, venueOverlay };
    }

    // Gerçek Simülasyon
    const { holds, closedPositions, pumpMintsTouched, dead } = simulatePump(address, all, pumpUniverse);

    if (pumpMintsTouched === 0) {
      return { transactionCount, firstTxSignature, firstTxBlockTime, approxWalletAgeDays, pumpStats: null, generalMedianHoldTimeSeconds, generalClosedPositions, generalUniqueMintsTraded, generalExitedUniqueMintsTraded, generalReEntryCount, generalFastCloseCount, generalDirectionalTxCount, venueOverlay };
    }

    const medianHold = Math.round(median(holds));
    // No closed positions → neutral jeet score (not punished for holding)
    const jeetScore = closedPositions === 0 ? 50 : jeetScoreFromMedianHold(medianHold);
    const rugMagnetScore = Math.round((dead / pumpMintsTouched) * 100);

    let confidence: ConfidenceLevel = "LOW";
    if (closedPositions >= 10) confidence = "HIGH";
    else if (closedPositions >= 3) confidence = "MEDIUM";

    return {
      transactionCount,
      firstTxSignature,
      firstTxBlockTime,
      approxWalletAgeDays,
      pumpStats: {
        pumpMintsTouched,
        closedPositions,
        medianHoldTimeSeconds: medianHold,
        jeetScore,
        rugMagnetScore,
        confidence,
      },
      generalMedianHoldTimeSeconds,
      generalClosedPositions,
      generalUniqueMintsTraded,
      generalExitedUniqueMintsTraded,
      generalReEntryCount,
      generalFastCloseCount,
      generalDirectionalTxCount,
      venueOverlay,
    };
  } catch (error) {
    console.error(`[getWalletTransactionData] Exception for ${address}:`, error);
    return { transactionCount: -1, firstTxSignature: null, firstTxBlockTime: null, approxWalletAgeDays: null, pumpStats: null, generalMedianHoldTimeSeconds: null, generalClosedPositions: null, generalUniqueMintsTraded: null, generalExitedUniqueMintsTraded: null, generalReEntryCount: null, generalFastCloseCount: null, generalDirectionalTxCount: null, venueOverlay: null };
  }
}