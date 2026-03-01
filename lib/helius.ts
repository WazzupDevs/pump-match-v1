import "server-only";
import type { PumpStats } from "@/types";

// SECURITY: Server-only API key. NEVER use NEXT_PUBLIC_ prefix for Helius key —
// that would expose it to the browser bundle and allow API abuse.
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

if (!HELIUS_API_KEY || typeof HELIUS_API_KEY !== "string" || HELIUS_API_KEY.trim().length === 0) {
  // eslint-disable-next-line no-console
  console.warn("⚠️ HELIUS_API_KEY is not set or invalid. Helius calls will fail.");
}

const HELIUS_RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY.trim()}`
  : null;

// Helius Enhanced Transactions API (REST, not RPC)
const HELIUS_API_BASE = "https://api.helius.xyz";

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

/**
 * Centralized RPC caller with robust error handling.
 * Returns null on error instead of throwing.
 */
async function callHeliusRpc<T>(method: string, params: unknown): Promise<T | null> {
  if (!HELIUS_RPC_URL) {
    // eslint-disable-next-line no-console
    console.error(`[Helius RPC] RPC URL not configured. Cannot call ${method}`);
    return null;
  }

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

    if (!response.ok) {
      const errorText = await response.text();
      // eslint-disable-next-line no-console
      console.error(`[Helius RPC] Request failed for ${method}:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 200), // Limit error text length
      });
      return null;
    }

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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[Helius RPC] Exception calling ${method}:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
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

  try {
    const limit = Math.min(options?.limit ?? 100, 100);
    const url = new URL(
      `${HELIUS_API_BASE}/v0/addresses/${address}/transactions`,
    );
    url.searchParams.set("api-key", apiKey.trim());
    url.searchParams.set("limit", String(limit));
    if (options?.before) {
      url.searchParams.set("before", options.before);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      // eslint-disable-next-line no-console
      console.error(
        `[Helius Enhanced API] HTTP ${response.status}:`,
        errorText.substring(0, 200),
      );
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? (data as EnhancedTransaction[]) : [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[Helius Enhanced API] Exception:`,
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

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

/**
 * Unified wallet transaction data fetcher using Helius Enhanced Transactions API.
 * Returns transaction count, wallet age, and Pump.fun stats (jeet/diamond/rug).
 */
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
    let cursor: string | undefined;

    const states = new Map<string, PositionState>();
    const pumpUniverse = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await fetchEnhancedTransactionPage(address, { limit: PAGE_SIZE, before: cursor });
      if (!batch.length) break;

      all.push(...batch);

      for (const tx of batch) {
        if (!tx.tokenTransfers?.length) continue;
        if (isPumpTx(tx)) {
          for (const tr of tx.tokenTransfers) {
            if (tr?.mint) pumpUniverse.add(tr.mint);
          }
        }
      }

      cursor = batch[batch.length - 1]?.signature;
      if (batch.length < PAGE_SIZE) break;
    }

    const transactionCount = all.length;
    if (transactionCount === 0) {
      return { transactionCount: 0, firstTxSignature: null, firstTxBlockTime: null, approxWalletAgeDays: null, pumpStats: null };
    }

    const oldest = all[all.length - 1];
    const firstTxSignature = oldest.signature ?? null;
    const firstTxBlockTime = oldest.timestamp ?? null;
    const approxWalletAgeDays = firstTxBlockTime != null ? Math.floor((Date.now() - firstTxBlockTime * 1000) / 86400000) : null;

    const chronological = [...all].reverse();
    const holds: number[] = [];
    let closedPositions = 0;

    for (const tx of chronological) {
      const ts = tx.timestamp;
      if (!ts || !tx.tokenTransfers?.length) continue;

      const pump = isPumpTx(tx);

      for (const tr of tx.tokenTransfers) {
        const mint = tr?.mint;
        if (!mint) continue;

        const isLikelyPumpMint = pump || pumpUniverse.has(mint) || mint.endsWith("pump");
        if (!isLikelyPumpMint) continue;

        const from = tr.fromUserAccount;
        const to = tr.toUserAccount;

        const amt = Number(tr.tokenAmount ?? 0);
        if (!Number.isFinite(amt) || amt === 0) continue;

        const delta = to === address ? amt : from === address ? -amt : 0;
        if (delta === 0) continue;

        const st = states.get(mint) ?? { balance: 0, openTs: null, everPump: false };
        if (pump) st.everPump = true;

        const prevBal = st.balance;
        const nextBal = prevBal + delta;

        const EPSILON = 1e-9;

        if (prevBal <= EPSILON && nextBal > EPSILON) {
          st.openTs = ts;
        }

        if (prevBal > EPSILON && nextBal <= EPSILON && st.openTs != null) {
          holds.push(Math.max(0, ts - st.openTs));
          closedPositions++;
          st.openTs = null;
        }

        const clamped = Math.abs(nextBal) <= EPSILON ? 0 : nextBal;
        st.balance = clamped;
        states.set(mint, st);
      }
    }

    const nowSec = Math.floor(Date.now() / 1000);
    let dead = 0;
    let pumpMintsTouched = 0;

    for (const [mint, st] of states.entries()) {
      const counted = st.everPump || pumpUniverse.has(mint);
      if (!counted) continue;

      pumpMintsTouched++;

      if (st.openTs != null) {
        const hold = Math.max(0, nowSec - st.openTs);
        holds.push(hold);
        if (hold > 3 * 24 * 60 * 60) dead++;
      }
    }

    if (pumpMintsTouched === 0) {
      return { transactionCount, firstTxSignature, firstTxBlockTime, approxWalletAgeDays, pumpStats: null };
    }

    const medianHold = Math.round(median(holds));
    const jeetScore = jeetScoreFromMedianHold(medianHold);
    const rugMagnetScore = Math.round((dead / pumpMintsTouched) * 100);

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
      },
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[getWalletTransactionData] Exception for ${address}:`, error);
    return {
      transactionCount: -1,
      firstTxSignature: null,
      firstTxBlockTime: null,
      approxWalletAgeDays: null,
      pumpStats: null,
    };
  }
}
