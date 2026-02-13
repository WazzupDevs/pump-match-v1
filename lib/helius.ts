import "server-only";

// API Key kontrolü ve RPC URL oluşturma
// Support both HELIUS_API_KEY (server-only, preferred) and NEXT_PUBLIC_HELIUS_API_KEY (fallback)
const HELIUS_API_KEY =
  process.env.HELIUS_API_KEY || process.env.NEXT_PUBLIC_HELIUS_API_KEY;

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

/**
 * Unified wallet transaction data fetcher using Helius Enhanced Transactions API.
 * Replaces BOTH getWalletTransactionHistory AND getFirstTransaction.
 *
 * Single API flow returns:
 *   - Transaction count (paginated, up to 1000)
 *   - First (oldest) transaction info for wallet age calculation
 *   - Funding source detection from parsed nativeTransfers
 *
 * Returns transactionCount = -1 on API failure (to distinguish from actual 0 txs).
 */
export async function getWalletTransactionData(address: string): Promise<{
  transactionCount: number;
  firstTxSignature: string | null;
  firstTxBlockTime: number | null;
  approxWalletAgeDays: number | null;
}> {
  try {
    const allTransactions: EnhancedTransaction[] = [];

    // Paginate through Enhanced API (100 per page, up to 1000 total)
    const MAX_PAGES = 10;
    const PAGE_SIZE = 100;
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await fetchEnhancedTransactionPage(address, {
        limit: PAGE_SIZE,
        before: cursor,
      });

      if (batch.length === 0) break;

      allTransactions.push(...batch);
      cursor = batch[batch.length - 1].signature;

      // If we got fewer than PAGE_SIZE, we've reached the end
      if (batch.length < PAGE_SIZE) break;
    }

    const transactionCount = allTransactions.length;

    if (transactionCount === 0) {
      return {
        transactionCount: 0,
        firstTxSignature: null,
        firstTxBlockTime: null,
        approxWalletAgeDays: null,
      };
    }

    // Enhanced API returns newest-first, so the last element is the oldest
    const oldestTx = allTransactions[allTransactions.length - 1];
    const firstTxSignature = oldestTx.signature;
    const firstTxBlockTime = oldestTx.timestamp ?? null;

    // Calculate approx wallet age in days
    let approxWalletAgeDays: number | null = null;
    if (firstTxBlockTime) {
      // Helius Enhanced API returns timestamp in seconds (Unix epoch)
      const ageMs = Date.now() - firstTxBlockTime * 1000;
      approxWalletAgeDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    }

    // ── HIDDEN KILLER FEATURE: Funding Source Detection ──
    // Extracted from parsed nativeTransfers — no separate getTransaction RPC call needed!
    // This is logged server-side ONLY. Never sent to client.
    if (oldestTx.nativeTransfers && oldestTx.nativeTransfers.length > 0) {
      const incomingTransfer = oldestTx.nativeTransfers.find(
        (t) => t.toUserAccount === address && t.fromUserAccount !== address,
      );
      if (incomingTransfer) {
        // eslint-disable-next-line no-console
        console.log(
          `[FUNDING_SOURCE_LOG] Wallet: ${address} funded by ${incomingTransfer.fromUserAccount} via ${firstTxSignature}`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `[FUNDING_SOURCE_LOG] Wallet: ${address} self-funded or funder undetectable. First tx: ${firstTxSignature}`,
        );
      }
    }

    return {
      transactionCount,
      firstTxSignature,
      firstTxBlockTime,
      approxWalletAgeDays,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[getWalletTransactionData] Exception for ${address}:`, error);
    return {
      transactionCount: -1, // API error, not actual 0 transactions
      firstTxSignature: null,
      firstTxBlockTime: null,
      approxWalletAgeDays: null,
    };
  }
}
