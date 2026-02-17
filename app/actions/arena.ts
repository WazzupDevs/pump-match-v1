"use server";

import { revalidatePath } from "next/cache";
import { getAsset } from "@/lib/helius";
import { getUserProfile } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { syncArenaMarketCaps } from "@/lib/arena-sync";

// ──────────────────────────────────────────────────────────────
// Arena Financial Snapshot Engine — Secure Claim Action
// Production-Grade: Proof of Authority (Founder Gate)
// ──────────────────────────────────────────────────────────────

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Solana System Program = renounced authority sentinel
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

type ClaimErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_INPUT"
  | "TOKEN_NOT_FOUND"
  | "INVALID_TOKEN_TYPE"
  | "ZERO_SUPPLY"
  | "INVALID_SYMBOL"
  | "RENOUNCED"
  | "AUTHORITY_MISMATCH"
  | "ALREADY_CLAIMED"
  | "DB_ERROR";

type ClaimResult = {
  success: boolean;
  message: string;
  errorCode?: ClaimErrorCode;
  projectId?: string;
};

/**
 * Extract the Update Authority from a Helius DAS asset response.
 *
 * Priority:
 *   1. content.metadata.update_authority (primary, most reliable)
 *   2. authorities[] array — find entry with "full" scope
 *   3. null if neither present
 */
function extractUpdateAuthority(asset: {
  content?: { metadata?: { update_authority?: string } };
  authorities?: Array<{ address: string; scopes: string[] }>;
}): string | null {
  // Primary source
  const metadataAuthority = asset.content?.metadata?.update_authority;
  if (metadataAuthority && metadataAuthority.length > 0) {
    return metadataAuthority;
  }

  // Fallback: authorities array (look for "full" scope = update authority)
  if (asset.authorities && asset.authorities.length > 0) {
    const fullAuthority = asset.authorities.find((a) =>
      a.scopes.includes("full"),
    );
    if (fullAuthority) {
      return fullAuthority.address;
    }
    // If no "full" scope, take the first authority as best guess
    return asset.authorities[0].address;
  }

  return null;
}

/**
 * Check if an authority address indicates the token is renounced.
 * Renounced = authority is null, empty, or the Solana System Program.
 */
function isAuthorityRenounced(authority: string | null): boolean {
  if (!authority || authority.trim().length === 0) return true;
  return authority.trim() === SYSTEM_PROGRAM;
}

/**
 * Claim a token project for a squad in the Arena.
 *
 * Final Hardened Logic — Production-Grade:
 *   1. Auth Guard — user must be opted-in network member
 *   2. Input Normalization — sanitize + Base58 format check
 *   3. Helius Truth Gate — on-chain verification via DAS getAsset
 *      a. Token existence + fungible type + supply > 0 + symbol validation
 *      b. Authority extraction (deterministic: metadata primary → authorities[] fallback)
 *      c. Renounced/invalid check — MVP blocks, future: community claim tier
 *   4. Idempotency & Replay Protection — explicit DB lookup before insert
 *      - Same founder re-claiming → success ("Welcome back, Founder.")
 *      - Different wallet → rejection ("Already claimed by another founder.")
 *   5. Proof of Authority — wallet must match on-chain update authority
 *   6. DB Commit — insert with claim_tier='founder', is_renounced=false
 */
export async function claimProjectAction(
  name: string,
  ca: string,
  walletAddress: string,
): Promise<ClaimResult> {
  const normalizedWallet = walletAddress.trim();

  // ── 1. Auth Guard ──
  const userProfile = await getUserProfile(normalizedWallet);

  if (!userProfile || !userProfile.isOptedIn) {
    return {
      success: false,
      errorCode: "AUTH_REQUIRED",
      message: "You must join the Pump Match Network before claiming a project.",
    };
  }

  // ── 2. Input Normalization ──
  const mintAddress = ca.trim();
  const projectName = name.trim();

  if (!projectName || projectName.length < 1 || projectName.length > 60) {
    return {
      success: false,
      errorCode: "INVALID_INPUT",
      message: "Project name must be between 1 and 60 characters.",
    };
  }

  if (!BASE58_REGEX.test(mintAddress)) {
    return {
      success: false,
      errorCode: "INVALID_INPUT",
      message: "Invalid contract address. Must be a valid Solana Base58 address.",
    };
  }

  // ── 3. Helius Truth Gate ──
  const asset = await getAsset(mintAddress);

  if (!asset) {
    return {
      success: false,
      errorCode: "TOKEN_NOT_FOUND",
      message: "Token not found on-chain. Verify the contract address.",
    };
  }

  // 3a. Interface must be fungible
  const isFungible =
    asset.interface === "FungibleToken" || asset.interface === "FungibleAsset";
  if (!isFungible) {
    return {
      success: false,
      errorCode: "INVALID_TOKEN_TYPE",
      message: `Invalid token type: "${asset.interface}". Only fungible tokens can be claimed.`,
    };
  }

  // 3a. Anti-Rug: supply must be > 0
  const supply = asset.token_info?.supply ?? 0;
  if (supply <= 0) {
    return {
      success: false,
      errorCode: "ZERO_SUPPLY",
      message: "Token supply is zero. This may be a rugged or invalid token.",
    };
  }

  // 3a. Symbol validation: 2-10 chars
  const symbol = asset.content?.metadata?.symbol ?? "";
  if (symbol.length < 2 || symbol.length > 10) {
    return {
      success: false,
      errorCode: "INVALID_SYMBOL",
      message: `Token symbol "${symbol}" is invalid. Must be 2-10 characters.`,
    };
  }

  // 3b. Extract Update Authority (Deterministic)
  const extractedAuthority = extractUpdateAuthority(asset);

  // 3c. Renounced / Invalid Authority Check
  if (isAuthorityRenounced(extractedAuthority)) {
    return {
      success: false,
      errorCode: "RENOUNCED",
      message:
        "This project is Renounced. Community Claim features are coming soon.",
    };
  }

  // ── 4. Idempotency & Replay Protection ──
  // Explicit DB check BEFORE authority verification — prevents unnecessary
  // Helius comparisons for already-claimed mints and enables "Welcome back".
  const { data: existingProject, error: lookupError } = await supabase
    .from("squad_projects")
    .select("id, claimed_by")
    .eq("mint_address", mintAddress)
    .maybeSingle();

  if (lookupError) {
    // eslint-disable-next-line no-console
    console.error("[claimProjectAction] DB lookup error:", lookupError);
    return {
      success: false,
      errorCode: "DB_ERROR",
      message: "Failed to verify project status. Please try again.",
    };
  }

  if (existingProject) {
    const existingOwner = (existingProject.claimed_by as string) ?? "";
    if (existingOwner.toLowerCase() === normalizedWallet.toLowerCase()) {
      // Same founder re-claiming — idempotent success
      return {
        success: true,
        message: "Welcome back, Founder. Your project is already in the Arena.",
        projectId: existingProject.id as string,
      };
    }
    // Different wallet trying to claim the same mint
    return {
      success: false,
      errorCode: "ALREADY_CLAIMED",
      message: "Project already claimed by another founder.",
    };
  }

  // ── 5. Proof of Authority (The Gate) ──
  // Connected wallet MUST be the active on-chain update authority
  if (extractedAuthority!.toLowerCase() !== normalizedWallet.toLowerCase()) {
    return {
      success: false,
      errorCode: "AUTHORITY_MISMATCH",
      message:
        "Ownership Verification Failed. You must be the active Update Authority to claim as Founder.",
    };
  }

  // ── 6. DB Commit ──
  const { data, error } = await supabase
    .from("squad_projects")
    .insert({
      name: projectName,
      mint_address: mintAddress,
      claimed_by: normalizedWallet,
      symbol,
      project_symbol: symbol,
      status: "active",
      claim_tier: "founder",
      is_renounced: false,
      update_authority: extractedAuthority,
      market_cap: null,
      fdv: null,
      liquidity_usd: null,
      volume_24h: null,
      last_valid_mc: null,
      last_mc_update: null,
    })
    .select("id")
    .single();

  if (error) {
    // Race condition safety net: unique constraint hit between our check and insert
    if (error.code === "23505") {
      return {
        success: true,
        message: "Welcome back, Founder. Your project is already in the Arena.",
      };
    }

    // eslint-disable-next-line no-console
    console.error("[claimProjectAction] Supabase insert error:", error);
    return {
      success: false,
      errorCode: "DB_ERROR",
      message: "Failed to claim project. Please try again.",
    };
  }

  // eslint-disable-next-line no-console
  console.log(
    `[Arena] Founder claim: ${projectName} ($${symbol}) by ${normalizedWallet.slice(0, 8)}... | authority: ${extractedAuthority} | mint: ${mintAddress}`,
  );

  return {
    success: true,
    message: `${projectName} ($${symbol}) has been claimed as Founder and is now in the Arena!`,
    projectId: data?.id as string | undefined,
  };
}

// ──────────────────────────────────────────────────────────────
// Arena Leaderboard — Data Fetchers (Pure DB Reads)
// ──────────────────────────────────────────────────────────────

export type EliteAgent = {
  rank: number;
  id: string;
  address: string;
  username: string;
  trustScore: number;
  isOptedIn: boolean;
  identityState: string;
};

export type PowerSquadProject = {
  rank: number;
  id: string;
  name: string;
  symbol: string;
  mint_address: string;
  claimed_by: string;
  status: string;
  claim_tier: string;
  is_renounced: boolean;
  market_cap: number | null;
  fdv: number | null;
  liquidity_usd: number | null;
  volume_24h: number | null;
  last_valid_mc: number | null;
  last_mc_update: string | null;
  created_at: string;
};

/**
 * Fetch top 10 opted-in agents sorted by trust_score DESC.
 * Pure DB read — no live API calls.
 */
export async function getEliteAgents(): Promise<EliteAgent[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, wallet_address, username, trust_score, is_opted_in, identity_state")
    .eq("is_opted_in", true)
    .order("trust_score", { ascending: false })
    .limit(10);

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[getEliteAgents] Supabase error:", error);
    return [];
  }

  return data.map((row, index) => ({
    rank: index + 1,
    id: row.id as string,
    address: row.wallet_address as string,
    username: (row.username as string) || "Anon",
    trustScore: row.trust_score as number,
    isOptedIn: true,
    identityState: (row.identity_state as string) || "GHOST",
  }));
}

/**
 * Fetch top 20 projects from squad_projects sorted by last_valid_mc DESC.
 * Pure DB read — no live Helius/DexScreener calls.
 */
export async function getPowerSquads(): Promise<PowerSquadProject[]> {
  const { data, error } = await supabase
    .from("squad_projects")
    .select("*")
    .order("last_valid_mc", { ascending: false, nullsFirst: false })
    .limit(20);

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[getPowerSquads] Supabase error:", error);
    return [];
  }

  return data.map((row, index) => ({
    rank: index + 1,
    id: row.id as string,
    name: row.name as string,
    symbol: (row.project_symbol as string) || (row.symbol as string) || "",
    mint_address: row.mint_address as string,
    claimed_by: row.claimed_by as string,
    status: (row.status as string) || "active",
    claim_tier: (row.claim_tier as string) || "community",
    is_renounced: (row.is_renounced as boolean) ?? false,
    market_cap: row.market_cap as number | null,
    fdv: row.fdv as number | null,
    liquidity_usd: row.liquidity_usd as number | null,
    volume_24h: row.volume_24h as number | null,
    last_valid_mc: row.last_valid_mc as number | null,
    last_mc_update: row.last_mc_update as string | null,
    created_at: row.created_at as string,
  }));
}

// ──────────────────────────────────────────────────────────────
// Arena Manual Sync Trigger — Admin Force Refresh
// ──────────────────────────────────────────────────────────────

type SyncResult = {
  success: boolean;
  processed: number;
  updated: number;
  ghosted: number;
  skipped: number;
  error?: string;
};

/**
 * Manual trigger for the Arena Market Cap sync.
 * Allows admins to force a refresh from the UI without waiting for cron.
 * Revalidates the leaderboard path after sync completes.
 */
export async function triggerManualSync(): Promise<SyncResult> {
  try {
    const result = await syncArenaMarketCaps();

    // Revalidate all cached pages that display arena data
    // "/" is the main dashboard where ArenaLeaderboard renders
    revalidatePath("/");
    revalidatePath("/arena");
    revalidatePath("/leaderboard");

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[triggerManualSync] Exception:",
      error instanceof Error ? error.message : String(error),
    );
    return {
      success: false,
      processed: 0,
      updated: 0,
      ghosted: 0,
      skipped: 0,
      error: "Manual sync failed unexpectedly",
    };
  }
}
