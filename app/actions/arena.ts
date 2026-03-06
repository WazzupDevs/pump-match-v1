"use server";

import { revalidatePath } from "next/cache";
import { PublicKey } from "@solana/web3.js";  
import { getAsset, type HeliusAssetInfo } from "@/lib/helius";
import { getUserProfile, getSquadMemberCounts, ensureUserAndProfileExists } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { syncArenaMarketCaps } from "@/lib/arena-sync";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";

// 🔥 TEK VE DOĞRU İMPORT SATIRI (Çakışmaları önler)
import {
  verifyWalletSignature,
  verifyLegacySignature,
  validateMessageTimestamp,
  validateSquadTransitionPayloadV2,
  generateCanonicalMessageV2,
  type PumpMatchPayload,
  type SquadTransitionPayloadV2,
} from "@/lib/signature";

const ENV = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
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
  | "DB_ERROR"
  | "RATE_LIMITED"
  | "SIGNATURE_FAILED";

type ClaimResult = {
  success: boolean;
  message: string;
  errorCode?: ClaimErrorCode;
  projectId?: string;
};

function extractUpdateAuthority(asset: HeliusAssetInfo): string | null {
  const metadataAuthority = asset.content?.metadata?.update_authority;
  if (metadataAuthority && metadataAuthority.length > 0) return metadataAuthority;
  if (asset.authorities && asset.authorities.length > 0) {
    const fullAuthority = asset.authorities.find((a) => a.scopes.includes("full"));
    if (fullAuthority) return fullAuthority.address;
    return asset.authorities[0].address;
  }
  return null;
}

function isAuthorityRenounced(authority: string | null): boolean {
  if (!authority || authority.trim().length === 0) return true;
  return authority.trim() === SYSTEM_PROGRAM;
}

// ──────────────────────────────────────────────────────────────
// Arena Financial Snapshot Engine — Secure Claim Action
// ──────────────────────────────────────────────────────────────
export async function claimProjectAction(payload: { name: string; mint: string; walletAddress: string; nonce: string; timestamp: number; signature: string; }): Promise<ClaimResult> {
  let canonicalWallet: string;
  let normalizedMint: string;
  try {
    canonicalWallet = new PublicKey(payload.walletAddress.trim()).toBase58();
  } catch {
    return { success: false, errorCode: "INVALID_INPUT", message: "Invalid wallet address." };
  }
  try {
    normalizedMint = new PublicKey(payload.mint.trim()).toBase58();
  } catch {
    return { success: false, errorCode: "INVALID_INPUT", message: "Invalid contract address." };
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rateKey = `claim:${canonicalWallet}:${normalizedMint}`;
  const rateCheck = await checkRateLimit(rateKey, RATE_LIMITS.CLAIM.maxRequests, RATE_LIMITS.CLAIM.windowMs);
  
  if (!rateCheck.allowed) return { success: false, errorCode: "RATE_LIMITED", message: "Too many claim attempts. Please wait." };

  const isExpired = Date.now() - payload.timestamp > 5 * 60 * 1000;
  if (isExpired) return { success: false, errorCode: "SIGNATURE_FAILED", message: "Signature expired. Please sign again." };

  // Consume nonce FIRST — prevents replay/brute-force regardless of sig outcome.
  // Each unique nonce can only be attempted once; getting new nonces is rate-limited.
  const { error: nonceError } = await supabaseAdmin.from("auth_nonces").insert({ nonce: payload.nonce, wallet_address: canonicalWallet, action: "claim_project" });
  if (nonceError) {
    if (nonceError.code === "23505") return { success: false, errorCode: "SIGNATURE_FAILED", message: "Replay attack detected." };
    return { success: false, errorCode: "DB_ERROR", message: "Security engine error." };
  }

  // Crypto verification uses canonical (case-preserved) base58 wallet address
  const expectedMessage = `Protocol: PumpMatch v1\nAction: claim_project\nWallet: ${canonicalWallet}\nTarget: ${normalizedMint}\nNonce: ${payload.nonce}\nTimestamp: ${payload.timestamp}`;
  const isValidSig = await verifyLegacySignature(canonicalWallet, expectedMessage, payload.signature);
  if (!isValidSig) return { success: false, errorCode: "SIGNATURE_FAILED", message: "Cryptographic verification failed. Context mismatch." };

  const userProfile = await getUserProfile(canonicalWallet);
  if (!userProfile || !userProfile.isOptedIn) {
    return { success: false, errorCode: "AUTH_REQUIRED", message: "You must join the Pump Match Network first." };
  }

  if (!payload.name || payload.name.length < 1 || payload.name.length > 60) return { success: false, errorCode: "INVALID_INPUT", message: "Invalid project name." };
  if (!BASE58_REGEX.test(normalizedMint)) return { success: false, errorCode: "INVALID_INPUT", message: "Invalid contract address." };

  const asset = await getAsset(normalizedMint);
  if (!asset) return { success: false, errorCode: "TOKEN_NOT_FOUND", message: "Token not found on-chain." };

  const isFungible = asset.interface === "FungibleToken" || asset.interface === "FungibleAsset";
  if (!isFungible) return { success: false, errorCode: "INVALID_TOKEN_TYPE", message: "Only fungible tokens can be claimed." };
  if ((asset.token_info?.supply ?? 0) <= 0) return { success: false, errorCode: "ZERO_SUPPLY", message: "Token supply is zero." };

  const symbol = asset.content?.metadata?.symbol ?? "";
  if (symbol.length < 2 || symbol.length > 10) return { success: false, errorCode: "INVALID_SYMBOL", message: "Invalid token symbol." };

  const extractedAuthority = extractUpdateAuthority(asset);
  if (isAuthorityRenounced(extractedAuthority)) return { success: false, errorCode: "RENOUNCED", message: "Project is Renounced. Community Claim coming soon." };

  let canonicalAuthority: string | null = null;
  if (extractedAuthority) {
    try {
      canonicalAuthority = new PublicKey(extractedAuthority.trim()).toBase58();
    } catch {
      canonicalAuthority = null;
    }
  }

  if (!canonicalAuthority || canonicalAuthority !== canonicalWallet) {
    return { success: false, errorCode: "AUTHORITY_MISMATCH", message: "Ownership Verification Failed. You must be the active Update Authority." };
  }

  const supabaseAdminForRead = getSupabaseAdmin();
  const { data: existingProject } = await supabaseAdminForRead
    .from("squad_projects")
    .select("id, created_by")
    .eq("mint_address", normalizedMint)
    .maybeSingle();

  if (existingProject) {
    if ((existingProject.created_by as string) === canonicalWallet) {
      return { success: true, message: "Welcome back, Founder.", projectId: existingProject.id as string };
    }
    return { success: false, errorCode: "ALREADY_CLAIMED", message: "Project already claimed by another founder." };
  }

  const { data, error } = await supabaseAdmin.from("squad_projects").insert({
      project_name: payload.name.trim(),
      mint_address: normalizedMint,
      created_by: canonicalWallet,
      created_by_wallet: canonicalWallet,
      project_symbol: symbol,
      status: "active",
      claim_tier: "founder",
      is_renounced: false,
      update_authority: canonicalAuthority,
      market_cap: null,
      liquidity_usd: null,
      volume_24h: null,
      last_valid_mc: null,
      last_mc_update: null,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") {
      // Race condition: another request inserted first — look up the existing row
      const { data: raceRow } = await supabaseAdmin
        .from("squad_projects")
        .select("id")
        .eq("mint_address", normalizedMint)
        .maybeSingle();
      return { success: true, message: "Welcome back, Founder.", projectId: raceRow?.id as string | undefined };
    }
    return { success: false, errorCode: "DB_ERROR", message: "Failed to claim project." };
  }

  const projectId = data?.id as string | undefined;

  // ── Insert founder as Leader into squad_members ──────────────
  // P0 FK: ensure users + profiles exist before squad_members insert
  if (projectId && userProfile) {
    const ensured = await ensureUserAndProfileExists(supabaseAdmin, userProfile.id, canonicalWallet);
    if (!ensured.success) {
      await supabaseAdmin.from("squad_projects").delete().eq("id", projectId);
      return { success: false, errorCode: "DB_ERROR", message: ensured.message };
    }
    const { error: memberError } = await supabaseAdmin
      .from("squad_members")
      .insert({
        project_id: projectId,
        user_id: userProfile.id,
        role: "Leader",
        status: "active",
      });

    if (memberError) {
      // Unique violation means founder was already added (idempotent)
      if (memberError.code !== "23505") {
        console.error("[claimProjectAction] squad_members insert error:", memberError);
        // Rollback: delete the orphaned project
        await supabaseAdmin.from("squad_projects").delete().eq("id", projectId);
        return { success: false, errorCode: "DB_ERROR", message: "Failed to register you as squad leader. Please try again." };
      }
    }
  }

  revalidatePath("/command-center");
  return { success: true, message: `${payload.name} ($${symbol}) has been claimed!`, projectId };
}

// ──────────────────────────────────────────────────────────────
// Arena Leaderboard — Data Fetchers
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
  created_by_wallet: string;
  created_by_wallet_full?: string;
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
  memberCount: number;
  /** Average trust score of active squad members. 0 if unknown. */
  squad_avg_trust_score: number;
  dev_tier: string;
  dev_trust_score: number;
  dev_status: "EXILED" | "ACTIVE" | "UNDER_REVIEW";
  project_trust_score: number;
  project_risk_band: "SAFE" | "LOW_RISK" | "MEDIUM" | "HIGH" | "EXTREME" | "RUGGED";
};

export async function getEliteAgents(): Promise<EliteAgent[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, wallet_address, username, trust_score, is_opted_in, identity_state")
    .eq("is_opted_in", true)
    .order("trust_score", { ascending: false })
    .limit(10);

  if (error || !data) return [];

  return data.map((row, index) => ({
    rank: index + 1,
    id: row.id as string,
    address: row.wallet_address as string,
    username: (row.username as string) || "Unknown",
    trustScore: (row.trust_score as number) || 0,
    isOptedIn: (row.is_opted_in as boolean) || false,
    identityState: (row.identity_state as string) || "ACTIVE",
  }));
}

type FounderStats = {
  score: number;
  tier: string;
  status: "EXILED" | "ACTIVE" | "UNDER_REVIEW";
};

export async function getPowerSquads(): Promise<PowerSquadProject[]> {
  const supabaseAdmin = getSupabaseAdmin();

  // Only show rankable projects (active + ghost). Rugged projects are excluded.
  const { data, error } = await supabaseAdmin
    .from("squad_projects")
    .select("*")
    .in("status", ["active", "ghost"])
    .order("last_valid_mc", { ascending: false, nullsFirst: false })
    .limit(20);

  if (error || !data) return [];

  const projectIds = data.map((row) => row.id as string);

  // Parallel fetch: member counts + squad member user_ids for trust score aggregation
  const [memberCountMap, squadTrustMap] = await Promise.all([
    getSquadMemberCounts(projectIds),
    getSquadAvgTrustScores(supabaseAdmin, projectIds),
  ]);

  const founders = Array.from(
    new Set(data.map((row) => row.created_by as string).filter(Boolean)),
  );
  const founderMap = new Map<string, FounderStats>();

  if (founders.length > 0) {
    const { data: usersData } = await supabaseAdmin
      .from("users")
      .select("wallet_address, trust_score, identity_state")
      .in("wallet_address", founders);

    if (usersData) {
      for (const u of usersData) {
        const isExiled = u.identity_state === "EXILED";
        let mappedTier = "Newbie";
        if (!isExiled) {
          if (u.trust_score >= 900) mappedTier = "Legendary";
          else if (u.trust_score >= 700) mappedTier = "Elite";
          else if (u.trust_score >= 400) mappedTier = "Proven";
          else if (u.trust_score >= 200) mappedTier = "Contributor";
        }
        founderMap.set(u.wallet_address as string, {
          score: (u.trust_score as number) ?? 0,
          tier: isExiled ? "EXILED" : mappedTier,
          status: isExiled ? "EXILED" : "ACTIVE",
        });
      }
    }
  }

  return data.map((row, index) => {
    const founderAddr = row.created_by as string;
    const maskedFounder =
      founderAddr && founderAddr.length > 10
        ? `${founderAddr.slice(0, 4)}...${founderAddr.slice(-4)}`
        : founderAddr;
    const projectId = row.id as string;
    const devStats: FounderStats = founderMap.get(founderAddr) ?? {
      score: 0,
      tier: "Newbie",
      status: "ACTIVE",
    };
    const memberCount = memberCountMap.get(projectId) ?? 0;

    return {
      rank: index + 1,
      id: projectId,
      name: (row.project_name as string) || "",
      symbol: (row.project_symbol as string) || "",
      mint_address: row.mint_address as string,
      created_by_wallet: maskedFounder,
      created_by_wallet_full: founderAddr,
      status: (row.status as string) || "active",
      claim_tier: (row.claim_tier as string) || "community",
      is_renounced: (row.is_renounced as boolean) ?? false,
      market_cap: row.market_cap as number | null,
      fdv: null,
      liquidity_usd: row.liquidity_usd as number | null,
      volume_24h: row.volume_24h as number | null,
      last_valid_mc: row.last_valid_mc as number | null,
      last_mc_update: row.last_mc_update as string | null,
      created_at: row.created_at as string,
      memberCount,
      squad_avg_trust_score: squadTrustMap.get(projectId) ?? 0,
      dev_tier: devStats.tier,
      dev_trust_score: devStats.score,
      dev_status: devStats.status,
      project_trust_score: (row.project_trust_score as number) || 0,
      project_risk_band:
        (row.project_risk_band as PowerSquadProject["project_risk_band"]) ||
        "EXTREME",
    };
  });
}

/**
 * Compute average trust score of active squad members per project.
 * Joins squad_members → users to aggregate real trust scores.
 */
async function getSquadAvgTrustScores(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  projectIds: string[],
): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map();

  // Fetch active squad members with their user_id
  const { data: members, error } = await supabase
    .from("squad_members")
    .select("project_id, user_id")
    .in("project_id", projectIds)
    .eq("status", "active");

  if (error || !members || members.length === 0) return new Map();

  // Collect unique user_ids to batch-fetch trust scores
  const userIds = Array.from(
    new Set(members.map((m) => m.user_id as string).filter(Boolean)),
  );

  if (userIds.length === 0) return new Map();

  const { data: usersData } = await supabase
    .from("users")
    .select("id, trust_score")
    .in("id", userIds);

  const trustMap = new Map<string, number>();
  if (usersData) {
    for (const u of usersData) {
      trustMap.set(u.id as string, (u.trust_score as number) ?? 0);
    }
  }

  // Aggregate per project
  const projectScores = new Map<string, { total: number; count: number }>();
  for (const m of members) {
    const pid = m.project_id as string;
    const uid = m.user_id as string;
    const score = trustMap.get(uid) ?? 0;
    const entry = projectScores.get(pid) ?? { total: 0, count: 0 };
    entry.total += score;
    entry.count += 1;
    projectScores.set(pid, entry);
  }

  const result = new Map<string, number>();
  for (const [pid, { total, count }] of projectScores) {
    result.set(pid, count > 0 ? Math.round(total / count) : 0);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────
// Arena Manual Sync Trigger
// ──────────────────────────────────────────────────────────────
export async function triggerManualSync(callerWallet: string, signedMessage: { message: string; signature: string }) {
  // Rate limit per wallet — prevents sync spam (5 per 15 min)
  const syncRateCheck = await checkRateLimit(`sync:${callerWallet.trim()}`, RATE_LIMITS.MANUAL_SYNC.maxRequests, RATE_LIMITS.MANUAL_SYNC.windowMs);
  if (!syncRateCheck.allowed) return { success: false, processed: 0, updated: 0, ghosted: 0, skipped: 0, error: "Too many sync attempts. Please wait." };
  if (!validateMessageTimestamp(signedMessage.message)) return { success: false, processed: 0, updated: 0, ghosted: 0, skipped: 0, error: "Signature expired. Please sign again." };

  // Verify signature — proves caller owns the wallet
  const isSyncSigValid = await verifyLegacySignature(callerWallet.trim(), signedMessage.message, signedMessage.signature);
  if (!isSyncSigValid) return { success: false, processed: 0, updated: 0, ghosted: 0, skipped: 0, error: "Signature verification failed." };

  try {
    const result = await syncArenaMarketCaps();
    revalidatePath("/"); revalidatePath("/arena"); revalidatePath("/leaderboard");
    return result;
  } catch {
    return { success: false, processed: 0, updated: 0, ghosted: 0, skipped: 0, error: "Manual sync failed unexpectedly" };
  }
}

// ──────────────────────────────────────────────────────────────
// 🔥 PUMPMATCH PROTOCOL: ACTION HANDLERS (V1.5 DAO-Ready) 🔥
// ──────────────────────────────────────────────────────────────

export async function addSquadMemberAction(payload: { projectId: string; targetWallet: string; founderWallet: string; role: string; nonce: string; timestamp: number; signature: string; }) {
  try {
    const founder = new PublicKey(payload.founderWallet.trim()).toBase58();
    const target = new PublicKey(payload.targetWallet.trim()).toBase58();

    const expectedPayload: PumpMatchPayload = {
      action: 'invite', chain: 'solana-mainnet', domain: 'pumpmatch-governance', env: ENV,
      nonce: payload.nonce, project: payload.projectId, role: payload.role, target: target, timestamp: payload.timestamp, v: 1
    };

    const { isValid, derivedActor, error: sigError } = await verifyWalletSignature(founder, payload.signature, expectedPayload);
    if (!isValid || !derivedActor) return { success: false, message: sigError || "Signature failed." };

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc('process_squad_transition', {
      p_project_id: payload.projectId, p_actor: derivedActor, p_target: target, p_action: 'invite', p_role: payload.role, p_nonce: payload.nonce, p_signature: payload.signature
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[Protocol Error - addSquadMemberAction]", err);
    return { success: false, message: "Protocol execution failed." };
  }
}

export async function joinSquadAction(payload: { projectId: string; walletAddress: string; role: string; nonce: string; timestamp: number; signature: string; }) {
  try {
    const applicant = new PublicKey(payload.walletAddress.trim()).toBase58();

    const expectedPayload: PumpMatchPayload = {
      action: 'apply', chain: 'solana-mainnet', domain: 'pumpmatch-governance', env: ENV,
      nonce: payload.nonce, project: payload.projectId, role: payload.role, target: applicant, timestamp: payload.timestamp, v: 1
    };

    const { isValid, derivedActor, error: sigError } = await verifyWalletSignature(applicant, payload.signature, expectedPayload);
    if (!isValid || !derivedActor) return { success: false, message: sigError || "Signature failed." };

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc('process_squad_transition', {
      p_project_id: payload.projectId, p_actor: derivedActor, p_target: applicant, p_action: 'apply', p_role: payload.role, p_nonce: payload.nonce, p_signature: payload.signature
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[Protocol Error - joinSquadAction]", err);
    return { success: false, message: "Protocol execution failed." };
  }
}

export async function executeSquadTransitionAction(input: {
  projectId: string;
  actorWallet: string;
  targetWallet: string;
  actionType: "approve_app" | "reject_app" | "accept_invite" | "reject_invite" | "revoke_invite" | "kick" | "leave";
  nonce: string;
  timestamp: number;
  signature: string;
}) {
  try {
    // 1. Base58 case-sensitive (Büyük/Küçük harf) yapısını bozmadan normalize et
    const actor = new PublicKey(input.actorWallet.trim()).toBase58();
    const target = new PublicKey(input.targetWallet.trim()).toBase58();

    // 2. V2 Canonical Payload (Role ve Env'den arındırılmış, deterministik yapı)
    const expectedPayload = {
      v: 2,
      domain: "pumpmatch-governance",
      chain: "solana-mainnet",
      projectId: input.projectId.trim(),
      actorWallet: actor,
      targetWallet: target,
      actionType: input.actionType,
      nonce: input.nonce.trim(),
      timestamp: Number(input.timestamp),
    } as const;

    // 3. Payload Zaman ve Şekil Doğrulaması (Future Skew & Expiry Koruması)
    const pv = validateSquadTransitionPayloadV2(expectedPayload);
    if (!pv.ok) return { success: false, message: pv.error };

    // 4. MÜKEMMEL KULLANIM: CANONICAL BYTES ÜRETİMİ
    // Objeyi alfabetik sıraya dizer ve doğrudan saf Uint8Array (Byte) üretir
    const messageBytes = generateCanonicalMessageV2(expectedPayload);

    // 5. İMZA DOĞRULAMASI (String'e Çevirmeden!)
    // Üretilen byte dizisini hiçbir encode/decode işlemine sokmadan doğrudan Nacl'a veriyoruz
    const isSignatureValid = await verifyLegacySignature(actor, messageBytes, input.signature);

    if (!isSignatureValid) {
      return { success: false, message: "Signature verification failed. Tampered payload or invalid signature." };
    }

    // 6. SUPABASE RPC ÇAĞRISI (Governance Execution - v2)
    // Rol ve diğer doğrulamalar SQL içindeki SECURITY DEFINER tarafından halledilir
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc("process_squad_transition_v2", {
      p_project_id: expectedPayload.projectId,
      p_actor: expectedPayload.actorWallet,
      p_target: expectedPayload.targetWallet,
      p_action: expectedPayload.actionType,
      p_nonce: expectedPayload.nonce,
      p_signature: input.signature,
      p_timestamp: expectedPayload.timestamp,
    });

    if (error) {
      // Replay Attack Guard (Aynı nonce tekrar kullanıldıysa UNIQUE CONSTRAINT patlar)
      if (error.code === "23505") {
        return { success: false, message: "Replay attack detected. Nonce already used." };
      }
      throw error;
    }

    return data ?? { success: true };
  } catch (err) {
    console.error("[Protocol Error - executeSquadTransitionAction]", err);
    return { success: false, message: "Governance transition failed due to internal error." };
  }
}
// app/actions/arena.ts dosyasının en altına eklenecek
// Terminal states: historical records, never shown in active squad UI
const TERMINAL_STATUSES = ['kicked', 'left', 'rejected', 'revoked'] as const;

export async function getSquadMembersAction(projectId: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const terminalList = `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(",")})`;
    const { data, error } = await supabaseAdmin
      .from("squad_members")
      .select("id, project_id, role, status, joined_at, left_at, user_id, profiles(wallet_address, x_handle)")
      .eq("project_id", projectId)
      .not("status", "in", terminalList);

    if (error) throw error;

    const members = (data ?? []).map((row: any) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const rawWallet = p?.wallet_address;
      const addr = typeof rawWallet === "string" && rawWallet.length > 0 ? rawWallet : "Unknown";
      const display =
        addr !== "Unknown" && addr.length > 8
          ? `${addr.slice(0, 4)}...${addr.slice(-4)}`
          : addr;

      if (addr === "Unknown") {
        console.warn(`[getSquadMembersAction] Missing wallet for user_id=${row.user_id}, project=${projectId}`);
      }

      return {
        id: row.id as string,
        projectId: row.project_id as string,
        walletAddress: addr,
        displayAddress: display,
        role: row.role as string | undefined,
        status: row.status as string,
        joinedAt: (row.joined_at as string) ?? new Date().toISOString(),
      };
    });

    return { success: true, data: members };
  } catch (error) {
    console.error("Error fetching squad members:", error);
    return { success: false, data: [] as any[] };
  }
}