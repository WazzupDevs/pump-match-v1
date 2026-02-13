import "server-only";

// API Key kontrolü ve RPC URL oluşturma
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

if (!HELIUS_API_KEY || typeof HELIUS_API_KEY !== "string" || HELIUS_API_KEY.trim().length === 0) {
  // eslint-disable-next-line no-console
  console.warn("⚠️ HELIUS_API_KEY is not set or invalid. Helius calls will fail.");
}

const HELIUS_RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY.trim()}`
  : null;

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

/**
 * Fetch transaction history for a wallet using Helius RPC getSignaturesForAddress.
 * Returns the count of transactions (up to 1000).
 * Returns -1 if the RPC call fails (to distinguish from actual 0 transactions).
 */
type SignatureInfo = {
  signature: string;
  slot: number;
  err?: unknown;
  memo?: string;
  blockTime?: number;
};

export async function getWalletTransactionHistory(address: string): Promise<number> {
  try {
    const result = await callHeliusRpc<SignatureInfo[]>("getSignaturesForAddress", [
      address,
      { limit: 1000 },
    ]);

    if (!result) {
      return -1; // API error, not actual 0 transactions
    }

    const count = Array.isArray(result) ? result.length : 0;
    return count;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[getWalletTransactionHistory] Exception for ${address}:`, error);
    return -1; // API error
  }
}

// ──────────────────────────────────────────────────────────────
// Production Grade: First Transaction & Wallet Age Detection
// ──────────────────────────────────────────────────────────────

/**
 * Fetch the oldest transaction signature for a wallet.
 * Uses `before` pagination to walk backwards, or fetches last page.
 * Returns the oldest SignatureInfo or null.
 *
 * Hidden Killer Feature: Logs funding source to server console.
 * This is NEVER exposed to the client.
 */
export async function getFirstTransaction(address: string): Promise<{
  firstTxSignature: string | null;
  firstTxBlockTime: number | null;
  approxWalletAgeDays: number | null;
}> {
  try {
    // Strategy: Fetch oldest signatures by using `limit: 1` with no `before` cursor
    // then paginate backwards. For efficiency, we fetch a batch and take the last one.
    const result = await callHeliusRpc<SignatureInfo[]>("getSignaturesForAddress", [
      address,
      { limit: 1000 }, // Fetch max batch
    ]);

    if (!result || !Array.isArray(result) || result.length === 0) {
      return { firstTxSignature: null, firstTxBlockTime: null, approxWalletAgeDays: null };
    }

    // The API returns newest-first, so the LAST element is the oldest in this batch
    const oldestInBatch = result[result.length - 1];

    // If we got exactly 1000 results, there may be more older ones.
    // Paginate backwards using the oldest signature as `before` cursor.
    let oldest = oldestInBatch;
    if (result.length === 1000) {
      let cursor = oldest.signature;
      let keepPaging = true;
      while (keepPaging) {
        const olderBatch = await callHeliusRpc<SignatureInfo[]>("getSignaturesForAddress", [
          address,
          { limit: 1000, before: cursor },
        ]);
        if (!olderBatch || !Array.isArray(olderBatch) || olderBatch.length === 0) {
          keepPaging = false;
        } else {
          oldest = olderBatch[olderBatch.length - 1];
          cursor = oldest.signature;
          if (olderBatch.length < 1000) keepPaging = false; // Last page
        }
      }
    }

    const firstTxSignature = oldest.signature;
    const firstTxBlockTime = oldest.blockTime ?? null;

    // Calculate approx wallet age in days
    let approxWalletAgeDays: number | null = null;
    if (firstTxBlockTime) {
      const ageMs = Date.now() - firstTxBlockTime * 1000;
      approxWalletAgeDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    }

    // ── HIDDEN KILLER FEATURE: Funding Source Log ──
    // Attempt to read the first transaction to identify the funder.
    // This is logged server-side ONLY. Never sent to client.
    if (firstTxSignature) {
      try {
        type ParsedTxResponse = {
          transaction?: {
            message?: {
              accountKeys?: Array<{ pubkey: string; signer: boolean; writable: boolean } | string>;
            };
          };
          meta?: {
            preBalances?: number[];
            postBalances?: number[];
          };
        };

        const txDetail = await callHeliusRpc<ParsedTxResponse>("getTransaction", [
          firstTxSignature,
          { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
        ]);

        if (txDetail?.transaction?.message?.accountKeys) {
          const accountKeys = txDetail.transaction.message.accountKeys;
          // The first signer that is NOT the wallet itself is likely the funder
          const funder = accountKeys.find((key) => {
            if (typeof key === "string") return key !== address;
            return key.signer && key.pubkey !== address;
          });
          const funderAddress = typeof funder === "string" ? funder : funder?.pubkey;

          if (funderAddress) {
            // eslint-disable-next-line no-console
            console.log(
              `[FUNDING_SOURCE_LOG] Wallet: ${address} funded by ${funderAddress} via ${firstTxSignature}`,
            );
          } else {
            // eslint-disable-next-line no-console
            console.log(
              `[FUNDING_SOURCE_LOG] Wallet: ${address} self-funded or funder undetectable. First tx: ${firstTxSignature}`,
            );
          }
        }
      } catch {
        // Non-critical: funding source detection is best-effort
        // eslint-disable-next-line no-console
        console.log(`[FUNDING_SOURCE_LOG] Wallet: ${address} - failed to parse first tx ${firstTxSignature}`);
      }
    }

    return { firstTxSignature, firstTxBlockTime, approxWalletAgeDays };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[getFirstTransaction] Exception for ${address}:`, error);
    return { firstTxSignature: null, firstTxBlockTime: null, approxWalletAgeDays: null };
  }
}
