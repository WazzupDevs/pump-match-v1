import "server-only";
import type { ConfidenceLevel, PumpStats } from "@/types";

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
// Non-critical: returns null on any failure — never throws.
// ──────────────────────────────────────────────────────────────

const WALLET_BALANCES_TIMEOUT_MS = 8000;

export async function getWalletBalances(
  address: string,
): Promise<{ totalUsdValue: number } | null> {
  const apiKey = HELIUS_API_KEY;
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.error("[getWalletBalances] HELIUS_API_KEY not configured.");
    return null;
  }

  const url = new URL(
    `${HELIUS_API_BASE}/v1/wallet/${address}/balances`,
  );
  url.searchParams.set("limit", "1");
  url.searchParams.set("showNfts", "false");
  url.searchParams.set("showZeroBalance", "false");
  url.searchParams.set("showNative", "true");

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

        if (!Number.isFinite(total)) return null;

        // 0 is a valid portfolio value (empty wallet)
        return { totalUsdValue: total };
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
        // eslint-disable-next-line no-console
        console.warn(`[getWalletBalances] 429, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (res.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000;
        // eslint-disable-next-line no-console
        console.warn(`[getWalletBalances] ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Client error — do not retry
      // eslint-disable-next-line no-console
      console.error(`[getWalletBalances] HTTP ${res.status} for ${address.slice(0, 8)}...`);
      return null;
    } catch (error) {
      clearTimeout(timeout);
      // eslint-disable-next-line no-console
      console.error(`[getWalletBalances] Exception (attempt ${attempt + 1}/${MAX_RETRIES}):`, error instanceof Error ? error.message : String(error));
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      return null;
    }
  }

  return null;
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

// 🚀 Zırhlanmış Ana Veri Çekme Fonksiyonu
export async function getWalletTransactionData(address: string): Promise<{
  transactionCount: number;
  firstTxSignature: string | null;
  firstTxBlockTime: number | null;
  approxWalletAgeDays: number | null;
  pumpStats: PumpStats | null;
}> {
  try {
    const all: EnhancedTransaction[] = [];
    const MAX_PAGES = 5;
    const PAGE_SIZE = 100;

    const EARLY_STOP_PAGES = 2;       // 200 tx
    const CLOSED_POS_TARGET = 30;     // Stat sufficiency (İstatistiksel yeterlilik sınırı)

    let cursor: string | undefined;
    let pumpTxCountSoFar = 0;
    const pumpUniverse = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await fetchEnhancedTransactionPage(address, { limit: PAGE_SIZE, before: cursor });
      if (!batch.length) break;

      all.push(...batch);

      // pump universe & pump tx counter güncellemeleri
      for (const tx of batch) {
        if (!tx.tokenTransfers?.length) continue;
        if (isPumpTx(tx)) {
          pumpTxCountSoFar++;
          for (const tr of tx.tokenTransfers) {
            // Only add mints that involve this wallet and are not WSOL
            if (tr?.mint && tr.mint !== WSOL_MINT && (tr.toUserAccount === address || tr.fromUserAccount === address)) {
              pumpUniverse.add(tr.mint);
            }
          }
        }
      }

      const oldestTxInBatch = batch[batch.length - 1];
      cursor = oldestTxInBatch?.signature;

      // 1) Epoch cutoff (Pump.fun çıkış tarihinden öncesine gitme)
      const oldestTsRaw = oldestTxInBatch?.timestamp;
      if (oldestTsRaw) {
        const oldestSec = toSec(oldestTsRaw);
        if (oldestSec < PUMP_FUN_EPOCH_SEC) break;
      }

      // 2) Relevance early stop (2 sayfa çektik ama hala Pump tx yoksa işlemi kes)
      if (page === EARLY_STOP_PAGES - 1 && pumpTxCountSoFar === 0) break;

      // 3) Stat sufficiency (Yeterli veri bulduysak, gereksiz sayfa çekme)
      if (pumpTxCountSoFar > 0 && page >= 1) {
        const sim = simulatePump(address, all, pumpUniverse);
        if (sim.closedPositions >= CLOSED_POS_TARGET) break;
      }

      if (batch.length < PAGE_SIZE) break;
    }

    const transactionCount = all.length;
    if (transactionCount === 0) {
      return { transactionCount: 0, firstTxSignature: null, firstTxBlockTime: null, approxWalletAgeDays: null, pumpStats: null };
    }

    const oldest = all[all.length - 1];
    const firstTxSignature = oldest.signature ?? null;
    const firstTxBlockTime = oldest.timestamp ?? null;
    const firstTxSec = firstTxBlockTime != null ? toSec(firstTxBlockTime) : null;
    const approxWalletAgeDays = firstTxSec != null ? Math.floor((Date.now() - firstTxSec * 1000) / 86400000) : null;

    if (pumpTxCountSoFar === 0) {
      return { transactionCount, firstTxSignature, firstTxBlockTime, approxWalletAgeDays, pumpStats: null };
    }

    // Gerçek Simülasyon
    const { holds, closedPositions, pumpMintsTouched, dead } = simulatePump(address, all, pumpUniverse);

    if (pumpMintsTouched === 0) {
      return { transactionCount, firstTxSignature, firstTxBlockTime, approxWalletAgeDays, pumpStats: null };
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
    };
  } catch (error) {
    console.error(`[getWalletTransactionData] Exception for ${address}:`, error);
    return { transactionCount: -1, firstTxSignature: null, firstTxBlockTime: null, approxWalletAgeDays: null, pumpStats: null };
  }
}