"use server";

import { revalidatePath } from "next/cache";
import { PublicKey } from "@solana/web3.js";  
import { getAsset } from "@/lib/helius";
import { getUserProfile, getSquadMemberCounts } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { syncArenaMarketCaps } from "@/lib/arena-sync";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";

// 🔥 TEK VE DOĞRU İMPORT SATIRI (Çakışmaları önler)
import { 
  verifyWalletSignature, 
  verifyLegacySignature, 
  validateMessageTimestamp, 
  type PumpMatchPayload 
} from "@/lib/signature";

const ENV = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

type ClaimErrorCode = "AUTH_REQUIRED" | "INVALID_INPUT" | "TOKEN_NOT_FOUND" | "INVALID_TOKEN_TYPE" | "ZERO_SUPPLY" | "INVALID_SYMBOL" | "RENOUNCED" | "AUTHORITY_MISMATCH" | "ALREADY_CLAIMED" | "DB_ERROR" | "RATE_LIMITED" | "SIGNATURE_FAILED";
type ClaimResult = { success: boolean; message: string; errorCode?: ClaimErrorCode; projectId?: string; };

function extractUpdateAuthority(asset: any): string | null {
  const metadataAuthority = asset.content?.metadata?.update_authority;
  if (metadataAuthority && metadataAuthority.length > 0) return metadataAuthority;
  if (asset.authorities && asset.authorities.length > 0) {
    const fullAuthority = asset.authorities.find((a: any) => a.scopes.includes("full"));
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
  const normalizedWallet = payload.walletAddress.trim().toLowerCase();
  const normalizedMint = payload.mint.trim();

  const rateKey = `claim:${normalizedWallet}:${normalizedMint}`;
  const claimRateLimit = (RATE_LIMITS as any).CLAIM || { maxRequests: 5, windowMs: 60000 };
  const rateCheck = await checkRateLimit(rateKey, claimRateLimit.maxRequests, claimRateLimit.windowMs);
  
  if (!rateCheck.allowed) return { success: false, errorCode: "RATE_LIMITED", message: "Too many claim attempts. Please wait." };

  const isExpired = Date.now() - payload.timestamp > 5 * 60 * 1000;
  if (isExpired) return { success: false, errorCode: "SIGNATURE_FAILED", message: "Signature expired. Please sign again." };

  // 🔥 ESKİ SİSTEM DOĞRULAMASI (LEGACY - Sadece Claim için)
  const expectedMessage = `Protocol: PumpMatch v1\nAction: claim_project\nWallet: ${normalizedWallet}\nTarget: ${normalizedMint}\nNonce: ${payload.nonce}\nTimestamp: ${payload.timestamp}`;
  const isValidSig = await verifyLegacySignature(normalizedWallet, expectedMessage, payload.signature);
  if (!isValidSig) return { success: false, errorCode: "SIGNATURE_FAILED", message: "Cryptographic verification failed. Context mismatch." };

  const { error: nonceError } = await supabase.from("auth_nonces").insert({ nonce: payload.nonce, wallet_address: normalizedWallet, action: "claim_project" });
  if (nonceError) {
    if (nonceError.code === "23505") return { success: false, errorCode: "SIGNATURE_FAILED", message: "Replay attack detected." };
    return { success: false, errorCode: "DB_ERROR", message: "Security engine error." };
  }

  const userProfile = await getUserProfile(normalizedWallet);
  if (!userProfile || !userProfile.isOptedIn) {
    await supabase.from("auth_nonces").delete().eq("nonce", payload.nonce);
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

  if (!extractedAuthority || extractedAuthority.toLowerCase() !== normalizedWallet) {
    await supabase.from("auth_nonces").delete().eq("nonce", payload.nonce);
    return { success: false, errorCode: "AUTHORITY_MISMATCH", message: "Ownership Verification Failed. You must be the active Update Authority." };
  }

  const { data: existingProject } = await supabase.from("squad_projects").select("id, claimed_by").eq("mint_address", normalizedMint).maybeSingle();

  if (existingProject) {
    if ((existingProject.claimed_by as string).toLowerCase() === normalizedWallet) return { success: true, message: "Welcome back, Founder.", projectId: existingProject.id as string };
    await supabase.from("auth_nonces").delete().eq("nonce", payload.nonce);
    return { success: false, errorCode: "ALREADY_CLAIMED", message: "Project already claimed by another founder." };
  }

  const { data, error } = await supabase.from("squad_projects").insert({
      name: payload.name.trim(), mint_address: normalizedMint, claimed_by: normalizedWallet, symbol, project_symbol: symbol, status: "active", claim_tier: "founder", is_renounced: false, update_authority: extractedAuthority.toLowerCase(), market_cap: null, fdv: null, liquidity_usd: null, volume_24h: null, last_valid_mc: null, last_mc_update: null,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") return { success: true, message: "Welcome back, Founder." };
    await supabase.from("auth_nonces").delete().eq("nonce", payload.nonce);
    return { success: false, errorCode: "DB_ERROR", message: "Failed to claim project." };
  }

  return { success: true, message: `${payload.name} ($${symbol}) has been claimed!`, projectId: data?.id as string | undefined };
}

// ──────────────────────────────────────────────────────────────
// Arena Leaderboard — Data Fetchers
// ──────────────────────────────────────────────────────────────
export type EliteAgent = { rank: number; id: string; address: string; username: string; trustScore: number; isOptedIn: boolean; identityState: string; };
export type PowerSquadProject = { rank: number; id: string; name: string; symbol: string; mint_address: string; claimed_by: string; claimed_by_full?: string; status: string; claim_tier: string; is_renounced: boolean; market_cap: number | null; fdv: number | null; liquidity_usd: number | null; volume_24h: number | null; last_valid_mc: number | null; last_mc_update: string | null; created_at: string; memberCount: number; squad_avg_trust_score: number; dev_tier: string; dev_trust_score: number; dev_status: "EXILED" | "ACTIVE" | "UNDER_REVIEW"; project_trust_score: number; project_risk_band: "SAFE" | "LOW_RISK" | "MEDIUM" | "HIGH" | "EXTREME" | "RUGGED"; };

export async function getEliteAgents(): Promise<EliteAgent[]> {
  const { data, error } = await supabase.from("users").select("id, wallet_address, username, trust_score, is_opted_in, identity_state").eq("is_opted_in", true).order("trust_score", { ascending: false }).limit(10);
  if (error || !data) return [];
  return data.map((row, index) => ({ rank: index + 1, id: row.id, address: row.wallet_address, username: row.username || "Unknown", trustScore: row.trust_score || 0, isOptedIn: row.is_opted_in || false, identityState: row.identity_state || "ACTIVE" }));
}

export async function getPowerSquads(): Promise<PowerSquadProject[]> {
  const { data, error } = await supabase.from("squad_projects").select("*").order("last_valid_mc", { ascending: false, nullsFirst: false }).limit(20);
  if (error || !data) return [];

  const projectIds = data.map((row) => row.id as string);
  const memberCountMap = await getSquadMemberCounts(projectIds);
  const founders = Array.from(new Set(data.map(row => row.claimed_by as string).filter(Boolean)));
  const founderMap = new Map();

  if (founders.length > 0) {
    const { data: usersData } = await supabase.from("users").select("wallet_address, trust_score, identity_state").in("wallet_address", founders);
    if (usersData) {
      usersData.forEach(u => {
        const isExiled = u.identity_state === "EXILED";
        let mappedTier = "Newbie";
        if (!isExiled) {
          if (u.trust_score >= 900) mappedTier = "Legendary";
          else if (u.trust_score >= 700) mappedTier = "Elite";
          else if (u.trust_score >= 400) mappedTier = "Proven";
          else if (u.trust_score >= 200) mappedTier = "Contributor";
        }
        founderMap.set(u.wallet_address, { score: u.trust_score ?? 0, tier: isExiled ? "EXILED" : mappedTier, status: isExiled ? "EXILED" : "ACTIVE" });
      });
    }
  }

  return data.map((row, index) => {
    const founderAddr = row.claimed_by as string;
    const maskedFounder = founderAddr && founderAddr.length > 10 ? `${founderAddr.slice(0, 4)}...${founderAddr.slice(-4)}` : founderAddr;
    const projectId = row.id as string;
    const devStats = founderMap.get(founderAddr) || { score: 0, tier: "Newbie", status: "ACTIVE" };

    return {
      rank: index + 1, id: projectId, name: row.name as string, symbol: (row.project_symbol as string) || (row.symbol as string) || "", mint_address: row.mint_address as string, claimed_by: maskedFounder, claimed_by_full: founderAddr, status: (row.status as string) || "active", claim_tier: (row.claim_tier as string) || "community", is_renounced: (row.is_renounced as boolean) ?? false, market_cap: row.market_cap as number | null, fdv: row.fdv as number | null, liquidity_usd: row.liquidity_usd as number | null, volume_24h: row.volume_24h as number | null, last_valid_mc: row.last_valid_mc as number | null, last_mc_update: row.last_mc_update as string | null, created_at: row.created_at as string, memberCount: memberCountMap.get(projectId) ?? 0,
      dev_tier: devStats.tier, dev_trust_score: devStats.score, dev_status: devStats.status, project_trust_score: (row.project_trust_score as number) || 0, project_risk_band: (row.project_risk_band as any) || "EXTREME",
      squad_avg_trust_score: memberCountMap.get(projectId) ? Math.max(0, Math.round(((row.project_trust_score as number) - (devStats.score * 0.6)) / 0.4)) : 0,
    };
  });
}

// ──────────────────────────────────────────────────────────────
// Arena Manual Sync Trigger
// ──────────────────────────────────────────────────────────────
export async function triggerManualSync(callerWallet: string, signedMessage: { message: string; signature: string }) {
  const adminWallet = process.env.ADMIN_WALLET;
  if (!adminWallet) return { success: false, processed: 0, updated: 0, ghosted: 0, skipped: 0, error: "Server misconfiguration: admin wallet not set." };
  if (!callerWallet || callerWallet.trim().toLowerCase() !== adminWallet.trim().toLowerCase()) return { success: false, processed: 0, updated: 0, ghosted: 0, skipped: 0, error: "Unauthorized. Admin access required." };

  const syncRateCheck = await checkRateLimit(`admin_sync:${callerWallet.trim()}`, RATE_LIMITS.MANUAL_SYNC.maxRequests, RATE_LIMITS.MANUAL_SYNC.windowMs);
  if (!syncRateCheck.allowed) return { success: false, processed: 0, updated: 0, ghosted: 0, skipped: 0, error: "Too many sync attempts. Please wait." };
  if (!validateMessageTimestamp(signedMessage.message)) return { success: false, processed: 0, updated: 0, ghosted: 0, skipped: 0, error: "Signature expired. Please sign again." };
  
  // 🔥 ESKİ SİSTEM DOĞRULAMASI (LEGACY)
  const isSyncSigValid = await verifyLegacySignature(callerWallet.trim(), signedMessage.message, signedMessage.signature);
  if (!isSyncSigValid) return { success: false, processed: 0, updated: 0, ghosted: 0, skipped: 0, error: "Signature verification failed." };

  try {
    const result = await syncArenaMarketCaps();
    revalidatePath("/"); revalidatePath("/arena"); revalidatePath("/leaderboard");
    return result;
  } catch (error) {
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

    const { data, error } = await supabase.rpc('process_squad_transition', {
      p_project_id: payload.projectId, p_actor: derivedActor, p_target: target, p_action: 'invite', p_role: payload.role, p_nonce: payload.nonce, p_signature: payload.signature
    });

    if (error) throw error;
    return data;
  } catch (err: any) {
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

    const { data, error } = await supabase.rpc('process_squad_transition', {
      p_project_id: payload.projectId, p_actor: derivedActor, p_target: applicant, p_action: 'apply', p_role: payload.role, p_nonce: payload.nonce, p_signature: payload.signature
    });

    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error("[Protocol Error - joinSquadAction]", err);
    return { success: false, message: "Protocol execution failed." };
  }
}

export async function executeSquadTransitionAction(payload: {
  projectId: string; actorWallet: string; targetWallet: string; actionType: 'approve_app' | 'reject_app' | 'accept_invite' | 'reject_invite' | 'revoke_invite' | 'kick' | 'leave'; role: string; nonce: string; timestamp: number; signature: string;
}) {
  try {
    const actor = new PublicKey(payload.actorWallet.trim()).toBase58();
    const target = new PublicKey(payload.targetWallet.trim()).toBase58();

    const expectedPayload: PumpMatchPayload = {
      action: payload.actionType, chain: 'solana-mainnet', domain: 'pumpmatch-governance', env: ENV,
      nonce: payload.nonce, project: payload.projectId, role: payload.role, target: target, timestamp: payload.timestamp, v: 1
    };

    const { isValid, derivedActor, error: sigError } = await verifyWalletSignature(actor, payload.signature, expectedPayload);
    if (!isValid || !derivedActor) return { success: false, message: sigError || "Signature verification failed." };

    const { data, error } = await supabase.rpc('process_squad_transition', {
      p_project_id: payload.projectId, p_actor: derivedActor, p_target: target, p_action: payload.actionType, p_role: payload.role, p_nonce: payload.nonce, p_signature: payload.signature
    });

    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error("[Protocol Error - executeSquadTransitionAction]", err);
    return { success: false, message: "Transition failed." };
  }
}

// app/actions/arena.ts dosyasının en altına eklenecek
export async function getSquadMembersAction(projectId: string) {
  try {
    const { data, error } = await supabase
      .from('squad_members')
      .select('*')
      .eq('project_id', projectId);
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching squad members:", error);
    return { success: false, data: [] };
  }
}