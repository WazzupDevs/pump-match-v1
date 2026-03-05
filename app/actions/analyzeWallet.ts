"use server";

import {
  getAssetsByOwner,
  getSolBalance,
  getWalletTransactionData,
  getWalletBalances,
  searchAssets,
  type DasAsset,
} from "@/lib/helius";
import { getMatches } from "@/lib/match-engine";
import {
  getUserProfile, isUserRegistered, upsertUser, findMatches, updateMatchSnapshot,
  getEndorsementCount, addEndorsement, getEndorsementCounts, getMyEndorsements,
  leaveNetwork,
} from "@/lib/db";
import { checkRateLimit, RATE_LIMITS, getRedisClient } from "@/lib/rate-limiter";
// SECURITY: Crypto helpers extracted to lib/signature.ts to avoid duplication
import { verifyLegacySignature as verifyWalletSignature } from "@/lib/signature";
import { headers } from "next/headers";
import { isArchitect } from "@/lib/architect";

import type {
  AnalyzeWalletResult,
  AnalyzeWalletResponse,
  Badge,
  BadgeCategory,
  BadgeId,
  BehavioralMetrics,
  ConfidenceLevel,
  MatchProfile,
  PumpStats,
  ScoreBreakdown,
  SocialLinks,
  UserIntent,
  UserProfile,
  WalletAnalysis,
} from "@/types";
import { getTokenMarketSnapshot } from "@/lib/market-data";

/**
 * Backward-compat normalizer: ensures confidence exists on PumpStats.
 * Cached responses stored before this field was added will lack it.
 */
function normalizePumpStats(ps: PumpStats | null): PumpStats | null {
  if (!ps) return null;
  if (ps.confidence) return ps;
  let confidence: ConfidenceLevel = "LOW";
  if ((ps.closedPositions ?? 0) >= 10) confidence = "HIGH";
  else if ((ps.closedPositions ?? 0) >= 3) confidence = "MEDIUM";
  return { ...ps, confidence };
}

// ──────────────────────────────────────────────────────────────
// Production Grade: Upstash Redis Cache (15-min TTL)
// Persists across Vercel serverless cold starts — replaces globalThis Map.
// Fallback: in-memory Map for local dev when Redis is not configured.
// Prevents Helius API spam and refresh attacks.
// ──────────────────────────────────────────────────────────────

type CachedAnalysis = {
  response: AnalyzeWalletResponse;
  timestamp: number;
};

const ANALYSIS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const ANALYSIS_CACHE_TTL_S  = 15 * 60;         // 900 seconds (for Redis SETEX)
const REDIS_CACHE_PREFIX    = "pump-match:analysis:";
// SECURITY (VULN-12): Cap in-memory fallback cache size to prevent unbounded growth
const MAX_ANALYSIS_CACHE_SIZE = 500;

// In-memory fallback (dev only — evicted on cold starts in production)
const globalForCache = globalThis as unknown as {
  analysisCache?: Map<string, CachedAnalysis>;
};
if (!globalForCache.analysisCache) {
  globalForCache.analysisCache = new Map<string, CachedAnalysis>();
}
const analysisCache = globalForCache.analysisCache;

async function getCachedAnalysis(key: string): Promise<CachedAnalysis | null> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get<string>(`${REDIS_CACHE_PREFIX}${key}`);
      if (raw) return JSON.parse(raw) as CachedAnalysis;
    } catch {
      // Redis error → fall through to in-memory check
    }
  }
  return analysisCache.get(key) ?? null;
}

async function setCachedAnalysis(key: string, value: CachedAnalysis): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.setex(`${REDIS_CACHE_PREFIX}${key}`, ANALYSIS_CACHE_TTL_S, JSON.stringify(value));
      return;
    } catch {
      // Redis error → fall through to in-memory store
    }
  }
  // In-memory fallback: evict oldest 10% when cap reached
  if (analysisCache.size >= MAX_ANALYSIS_CACHE_SIZE) {
    const evictCount = Math.ceil(MAX_ANALYSIS_CACHE_SIZE * 0.1);
    for (const k of [...analysisCache.keys()].slice(0, evictCount)) {
      analysisCache.delete(k);
    }
  }
  analysisCache.set(key, value);
}

/**
 * Production Grade: Solana Address Validation
 * Valid Solana addresses are base58-encoded, 32-44 characters.
 * Does NOT accept .sol domains (those should be resolved before calling this).
 */
function isValidSolanaAddress(address: string): boolean {
  // Base58 charset: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Universal address normalization: trims, strips "web3:solana:" prefix,
 * validates base58 format. Returns the clean address or throws.
 * DO NOT toLowerCase — Solana base58 is case-sensitive.
 */
function normalizeAndValidateSolanaAddress(address: string): string {
  let trimmed = address.trim();
  if (trimmed.startsWith("web3:solana:")) trimmed = trimmed.slice("web3:solana:".length);
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!base58Regex.test(trimmed)) throw new Error("Invalid Solana address format.");
  return trimmed;
}

function computeTokenCount(items: DasAsset[]): number {
  // Only count fungible tokens (coins), not NFTs
  return items.filter(
    (item) => item.interface === "FungibleToken" || item.interface === "FungibleAsset",
  ).length;
}


function computeTokenDiversity(items: DasAsset[]): number {
  // Count unique token types by their interface and id
  const uniqueTokens = new Set<string>();
  items.forEach((item) => {
    if (
      item.interface === "FungibleToken" ||
      item.interface === "FungibleAsset" ||
      item.interface === "V1_NFT"
    ) {
      if (item.id) {
        uniqueTokens.add(item.id);
      }
    }
  });
  return uniqueTokens.size > 0 ? uniqueTokens.size : computeTokenCount(items);
}

// ---------------- 1. BÖLÜM: BADGE & SCORE ENGINE ----------------

const BADGE_DEFINITIONS: Record<BadgeId, { label: string; category: BadgeCategory; baseWeight: number; icon: string }> = {
  whale: { label: "Whale", category: "SYSTEM", baseWeight: 6, icon: "Waves" },
  dev: { label: "Dev", category: "SYSTEM", baseWeight: 5, icon: "Code" },
  og_wallet: { label: "OG Wallet", category: "SYSTEM", baseWeight: 4, icon: "Clock" },
  community_trusted: { label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
  diamond_hands: { label: "Diamond Hands", category: "SYSTEM", baseWeight: 10, icon: "Sparkles" },
  mega_jeet: { label: "Mega Jeet", category: "SYSTEM", baseWeight: 0, icon: "Fish" },
  rug_magnet: { label: "Rug Magnet", category: "SYSTEM", baseWeight: 0, icon: "AlertTriangle" },
};

function assignBadges(
  solBalance: number,
  transactionCount: number,
  tokenDiversity: number,
  pumpStats: PumpStats | null,
): BadgeId[] {
  const badges: BadgeId[] = [];

  if (solBalance > 10) badges.push("whale");
  if (transactionCount > 1000 && transactionCount !== -1) badges.push("og_wallet");
  if (tokenDiversity > 10) badges.push("dev");

  if (pumpStats && pumpStats.pumpMintsTouched >= 3) {
    if (pumpStats.closedPositions >= 3 && pumpStats.jeetScore >= 90) badges.push("mega_jeet");
    if (pumpStats.closedPositions >= 1 && pumpStats.jeetScore <= 10 && pumpStats.rugMagnetScore < 40) {
      badges.push("diamond_hands");
    }
    if (pumpStats.rugMagnetScore >= 60 && pumpStats.pumpMintsTouched >= 10) badges.push("rug_magnet");
  }
  return badges;
}

function calculateScore(
  solBalance: number,
  transactionCount: number,
  tokenDiversity: number,
  pumpStats: PumpStats | null,
): ScoreBreakdown {
  const balanceScore = Math.min(40, Math.floor(solBalance * 4));
  const isApiError = transactionCount === -1;
  const effectiveTx = isApiError ? 0 : transactionCount;

  let activityScore = 0;
  if (effectiveTx >= 1000) activityScore = 40;
  else if (effectiveTx >= 300) activityScore = 30;
  else if (effectiveTx >= 100) activityScore = 22;
  else if (effectiveTx >= 50) activityScore = 15;
  else if (effectiveTx >= 10) activityScore = 7;
  else if (effectiveTx >= 1) activityScore = 2;

  const diversityScore = tokenDiversity > 5 ? 20 : Math.min(20, tokenDiversity * 4);
  const basePenalty = effectiveTx < 5 && !isApiError ? 20 : 0;

  const explanations: string[] = [];
  let pumpPenalty = 0;
  let pumpBonus = 0;

  if (pumpStats && pumpStats.pumpMintsTouched >= 3) {
    const jeetScale = pumpStats.closedPositions > 0 ? 1 : 0.35;
    const jeetPen = Math.round(((pumpStats.jeetScore / 100) * 30) * jeetScale);
    const rugPen = Math.round((pumpStats.rugMagnetScore / 100) * 20);

    pumpPenalty += jeetPen + rugPen;

    if (pumpStats.closedPositions >= 1 && pumpStats.jeetScore <= 10 && pumpStats.rugMagnetScore < 40) {
      pumpBonus = 20;
    }

    if (jeetPen > 0) explanations.push(`Jeet Penalty (-${jeetPen})`);
    if (rugPen > 0) explanations.push(`Rug Exposure (-${rugPen})`);
    if (pumpBonus > 0) explanations.push(`Diamond Bonus (+${pumpBonus})`);
  }

  const baseScore = balanceScore + activityScore + diversityScore - basePenalty;
  const total = Math.max(0, Math.min(100, baseScore - pumpPenalty + pumpBonus));

  return {
    balanceScore,
    activityScore,
    diversityScore,
    penalty: basePenalty + pumpPenalty,
    total,
    explanation: explanations.join(" · ") || "Standard profile",
  };
}

/**
 * Pump Match - Score Calculation (Transparency)
 * System Score: System badge'lerin ağırlık toplamı
 * Social Score: Social badge'leri ağırlığa göre sırala -> Decay [1, 0.6, 0.3] uygula -> Topla
 */
function calculateBadgeScores(badgeIds: BadgeId[]): { systemScore: number; socialScore: number } {
  const systemBadges: Badge[] = [];
  const socialBadges: Badge[] = [];

  // Badge'leri kategorilere ayır
  badgeIds.forEach((badgeId) => {
    const def = BADGE_DEFINITIONS[badgeId];
    if (def) {
      const badge: Badge = {
        id: badgeId,
        label: def.label,
        category: def.category,
        baseWeight: def.baseWeight,
        icon: def.icon,
      };
      if (def.category === "SYSTEM") {
        systemBadges.push(badge);
      } else {
        socialBadges.push(badge);
      }
    }
  });

  // System Score: Toplam ağırlık
  const systemScore = systemBadges.reduce((sum, badge) => sum + badge.baseWeight, 0);

  // Social Score: Ağırlığa göre sırala -> Decay uygula
  const sortedSocialBadges = [...socialBadges].sort((a, b) => b.baseWeight - a.baseWeight);
  const decayFactors = [1, 0.6, 0.3]; // İlk 3 badge için decay
  const socialScore = sortedSocialBadges.reduce((sum, badge, index) => {
    const decay = index < decayFactors.length ? decayFactors[index] : 0;
    return sum + badge.baseWeight * decay;
  }, 0);

  return { systemScore, socialScore };
}

// Pump Match - Score label calculation removed (no client-side logic)

// ──────────────────────────────────────────────────────────────
// V8 Analysis Engine — Pipeline Stages
// ──────────────────────────────────────────────────────────────

/** Stage 1 output: raw on-chain data collected from Helius APIs */
type OnchainCore = {
  solBalance: number;
  transactionCount: number;
  fungibleTokens: number;
  totalNfts: number;
  totalAssets: number;
  tokenDiversity: number;
  activityCount: number;
  pumpStats: PumpStats | null;
  approxWalletAgeDays: number | null;
  portfolioValueUsd: number | undefined;
  scoreBreakdown: ScoreBreakdown;
  badges: BadgeId[];
  /** Up to 5 unique fungible token mints for market data enrichment */
  fungibleMints: string[];
};

/**
 * V8 Stage 1: Fetch all on-chain data in parallel.
 * Pure data collection — no DB writes, no side-effects.
 */
async function fetchOnchainCore(trimmed: string): Promise<OnchainCore> {
  const [assetsByOwnerResult, solBalance, txData, balancesData] = await Promise.all([
    getAssetsByOwner(trimmed),
    getSolBalance(trimmed),
    getWalletTransactionData(trimmed),
    getWalletBalances(trimmed).catch(() => null),
  ]);

  const transactionCount = txData.transactionCount;
  const pumpStats = txData.pumpStats;
  const assetsByOwner = assetsByOwnerResult || { items: [], total: 0 };

  let fungibleTokens = 0;
  let totalNfts = 0;

  try {
    const fungibleTokensResult = await searchAssets({
      ownerAddress: trimmed,
      tokenType: "fungible",
      limit: 1,
    });
    if (fungibleTokensResult) {
      const rawTotal = fungibleTokensResult.assets?.total ?? fungibleTokensResult.total;
      fungibleTokens = typeof rawTotal === "number" && rawTotal >= 0 ? rawTotal : 0;
    }
  } catch (error) {
    console.warn(`[fetchOnchainCore] Failed to fetch fungible tokens:`, error);
  }

  try {
    const nonFungibleTokensResult = await searchAssets({
      ownerAddress: trimmed,
      tokenType: "nonFungible",
      limit: 1,
    });
    if (nonFungibleTokensResult) {
      const rawTotal = nonFungibleTokensResult.assets?.total ?? nonFungibleTokensResult.total;
      totalNfts = typeof rawTotal === "number" && rawTotal >= 0 ? rawTotal : 0;
    }
  } catch (error) {
    console.warn(`[fetchOnchainCore] Failed to fetch NFTs:`, error);
  }

  const totalAssets = fungibleTokens + totalNfts;
  const tokenDiversity = computeTokenDiversity(assetsByOwner.items);
  const activityCount = totalAssets + (transactionCount > 0 ? transactionCount : 0);
  const scoreBreakdown = calculateScore(solBalance, transactionCount, tokenDiversity, pumpStats);
  const badges = assignBadges(solBalance, transactionCount, tokenDiversity, pumpStats);

  // Extract up to 5 unique fungible token mints for market data enrichment
  const WSOL = "So11111111111111111111111111111111111111112";
  const mintSet = new Set<string>();
  for (const item of assetsByOwner.items) {
    if (mintSet.size >= 5) break;
    if (
      (item.interface === "FungibleToken" || item.interface === "FungibleAsset") &&
      item.id &&
      item.id !== WSOL
    ) {
      mintSet.add(item.id);
    }
  }

  return {
    solBalance,
    transactionCount,
    fungibleTokens,
    totalNfts,
    totalAssets,
    tokenDiversity,
    activityCount,
    pumpStats,
    approxWalletAgeDays: txData.approxWalletAgeDays,
    portfolioValueUsd: balancesData?.totalUsdValue,
    scoreBreakdown,
    badges,
    fungibleMints: [...mintSet],
  };
}

/**
 * V8 Stage 2: Derive behavioral metrics from on-chain core data.
 * Uses only data already fetched — zero additional API calls.
 */
function deriveBehavioralMetrics(core: OnchainCore): BehavioralMetrics | undefined {
  const { pumpStats, transactionCount, approxWalletAgeDays } = core;

  // Without pumpStats we cannot derive meaningful behavioral metrics
  if (!pumpStats || pumpStats.pumpMintsTouched < 1) {
    return undefined;
  }

  const jeetIndex = pumpStats.jeetScore;
  const rugExposureIndex = pumpStats.rugMagnetScore;
  const avgHoldingTimeSec = pumpStats.medianHoldTimeSeconds > 0
    ? pumpStats.medianHoldTimeSeconds
    : undefined;

  // Trade frequency: closedPositions relative to wallet age (days active)
  let tradeFreqScore: number | undefined;
  if (approxWalletAgeDays != null && approxWalletAgeDays > 0) {
    const tradesPerDay = pumpStats.closedPositions / approxWalletAgeDays;
    // Scale: 0 trades/day = 0, 5+ trades/day = 100
    tradeFreqScore = Math.min(100, Math.round(tradesPerDay * 20));
  } else if (transactionCount > 0) {
    // Fallback: use raw closed positions as a rough proxy
    tradeFreqScore = Math.min(100, pumpStats.closedPositions * 5);
  }

  // Build confidence label based on available data sources
  const sources: string[] = ["Helius Enhanced TX"];
  if (pumpStats.closedPositions >= 3) sources.push("Pump Simulation");
  if (approxWalletAgeDays != null) sources.push("Wallet Age");
  const confidenceLabel = sources.join(" + ");

  return {
    jeetIndex,
    rugExposureIndex,
    avgHoldingTimeSec,
    tradeFreqScore,
    confidenceLabel,
  };
}

/**
 * V8 Stage 3: Enrich with DexScreener market data.
 * Fail-safe: never throws, never slows core pipeline.
 * Uses Promise.allSettled + per-mint timeout (4s) + mint cap (5).
 */
async function enrichWithMarketData(
  walletAnalysis: WalletAnalysis,
  core: OnchainCore,
): Promise<WalletAnalysis> {
  try {
    const mints = core.fungibleMints;
    if (mints.length === 0) return walletAnalysis;

    const results = await Promise.allSettled(
      mints.map((m) => getTokenMarketSnapshot(m)),
    );

    const topTokens = results
      .filter((r): r is PromiseFulfilledResult<import("@/types").MarketSnapshot | null> =>
        r.status === "fulfilled" && r.value != null,
      )
      .map((r) => r.value!)
      .sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))
      .slice(0, 3);

    if (topTokens.length === 0) return walletAnalysis;

    return { ...walletAnalysis, marketData: { topTokens } };
  } catch {
    return walletAnalysis;
  }
}

// ──────────────────────────────────────────────────────────────
// Main Entry Point
// ──────────────────────────────────────────────────────────────

export async function analyzeWallet(address: string, userIntent?: UserIntent): Promise<AnalyzeWalletResponse> {
  // Universal normalization + validation (strips web3:solana: prefix, validates base58)
  const trimmed = normalizeAndValidateSolanaAddress(address);

  // SECURITY: IP-based rate limit — protects Helius API from distributed abuse
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? "unknown";
  const ipRateCheck = await checkRateLimit(`analyze_ip:${ip}`, RATE_LIMITS.ANALYZE_WALLET.maxRequests * 2, RATE_LIMITS.ANALYZE_WALLET.windowMs);
  if (!ipRateCheck.allowed) {
    throw new Error("IP Rate limit exceeded. Please wait before analyzing again.");
  }

  // SECURITY (VULN-04): Cache key is address-only — NOT intent-dependent.
  const cacheKey = trimmed;
  const cached = await getCachedAnalysis(cacheKey);
  if (cached && Date.now() - cached.timestamp < ANALYSIS_CACHE_TTL_MS) {
    // eslint-disable-next-line no-console
    console.log(`[analyzeWallet] Cache HIT for ${trimmed.slice(0, 8)}... (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);

    // Backward-compat: normalize pumpStats.confidence for pre-V8 cached responses
    const cachedWa = cached.response.walletAnalysis;
    const normalizedPs = normalizePumpStats(cachedWa.pumpStats);
    const needsNormalize = normalizedPs !== cachedWa.pumpStats;

    // If intent changed, update it in the cached response without re-fetching
    if ((userIntent && cachedWa.intent !== userIntent) || needsNormalize) {
      const updatedAnalysis = {
        ...cachedWa,
        ...(userIntent ? { intent: userIntent } : {}),
        ...(needsNormalize ? { pumpStats: normalizedPs } : {}),
      };
      const updatedMatches = getMatches(updatedAnalysis);
      return { ...cached.response, walletAnalysis: updatedAnalysis, matches: updatedMatches };
    }
    return cached.response;
  }

  // SECURITY (VULN-11): Rate limit by wallet address — prevents Helius API exhaustion
  const rateCheck = await checkRateLimit(trimmed, RATE_LIMITS.ANALYZE_WALLET.maxRequests, RATE_LIMITS.ANALYZE_WALLET.windowMs);
  if (!rateCheck.allowed) {
    const retryInMin = Math.ceil(rateCheck.retryAfterMs / 60000);
    throw new Error(`Rate limit exceeded. Please wait ${retryInMin} minute(s) before analyzing again.`);
  }

  try {
    // ── V8 Stage 1: Fetch on-chain core ──
    const core = await fetchOnchainCore(trimmed);

    // ── V8 Stage 2: Derive behavioral metrics ──
    const behavioral = deriveBehavioralMetrics(core);

    const { solBalance, transactionCount, fungibleTokens, totalNfts, totalAssets,
            tokenDiversity, activityCount, pumpStats, portfolioValueUsd } = core;
    let { scoreBreakdown, badges } = core;

    const analysisResult: AnalyzeWalletResult = {
      address: trimmed,
      solBalance,
      tokenCount: fungibleTokens,
      nftCount: totalNfts,
      assetCount: totalAssets,
      activityCount,
      transactionCount,
      tokenDiversity,
      scoreBreakdown,
    };

    const trustScore = scoreBreakdown.total;
    const score = trustScore;
    const scoreLabel = trustScore >= 80 ? "Strong Activity" : trustScore >= 50 ? "Moderate Activity" : "Low Activity";

    // Opt-In Network Architecture - Check if user is registered
    const isRegistered = await isUserRegistered(trimmed);

    // Community badge: For registered users use real endorsement count
    if (isRegistered) {
      const endorsementCount = await getEndorsementCount(trimmed);
      const badgeIdx = badges.indexOf('community_trusted');
      if (endorsementCount >= 3 && badgeIdx === -1) {
        badges.push('community_trusted');
      } else if (endorsementCount < 3 && badgeIdx !== -1) {
        badges.splice(badgeIdx, 1);
      }
    }

    const { systemScore, socialScore } = calculateBadgeScores(badges);

    // SECURITY (VULN-03): Only update trust score for ALREADY-REGISTERED users.
    const architectActive = isArchitect(trimmed);
    if (isRegistered && !architectActive) {
      try {
        const calculatedLevel = badges.includes("whale") ? "Whale" :
                                badges.includes("dev") ? "Dev" :
                                badges.includes("og_wallet") ? "OG" : "Rookie";

        await upsertUser(trimmed, {
          trust_score: trustScore,
          level: calculatedLevel,
        });
      } catch (dbError) {
        console.error("[analyzeWallet] Supabase Sync Failed:", dbError);
      }
    }

    // ── Architect Mode: in-memory overrides (never persisted to DB) ──
    let finalTrustScore = trustScore;
    let finalScore = score;
    let finalScoreLabel = scoreLabel;
    let finalScoreBreakdown = scoreBreakdown;
    let finalBadges: BadgeId[] = badges;
    let finalSystemScore = systemScore;
    let finalSocialScore = socialScore;

    if (architectActive) {
      console.log(`[analyzeWallet] ARCHITECT MODE active for ${trimmed.slice(0, 8)}...`);
      finalTrustScore = 99;
      finalScore = 99;
      finalScoreLabel = "CHAD";
      finalScoreBreakdown = {
        balanceScore: 40,
        activityScore: 40,
        diversityScore: 20,
        penalty: 0,
        total: 99,
        explanation: "Architect Mode · All scores maxed",
      };
      finalBadges = ["whale", "dev", "og_wallet", "diamond_hands", "community_trusted"];
      const archBadgeScores = calculateBadgeScores(finalBadges);
      finalSystemScore = archBadgeScores.systemScore;
      finalSocialScore = archBadgeScores.socialScore;
    }

    let walletAnalysis: WalletAnalysis = {
      address: trimmed,
      solBalance,
      tokenCount: fungibleTokens,
      nftCount: totalNfts,
      assetCount: totalAssets,
      score: finalScore,
      scoreLabel: finalScoreLabel,
      trustScore: finalTrustScore,
      badges: finalBadges,
      transactionCount,
      tokenDiversity,
      scoreBreakdown: finalScoreBreakdown,
      systemScore: finalSystemScore,
      socialScore: finalSocialScore,
      intent: userIntent,
      isRegistered,
      approxWalletAge: core.approxWalletAgeDays ?? undefined,
      pumpStats: normalizePumpStats(pumpStats),
      portfolioValueUsd,
      behavioral,
    };

    // ── V8 Stage 3: Enrich with market data (stub — no-op for now) ──
    walletAnalysis = await enrichWithMarketData(walletAnalysis, core);

    // Match Engine: Calculate matches (read-only, mock data for preview)
    const matches = getMatches(walletAnalysis);

    const response: AnalyzeWalletResponse = {
      analysis: analysisResult,
      walletAnalysis,
      matches,
    };

    // Production Grade: Store in Redis (or in-memory fallback for dev)
    await setCachedAnalysis(cacheKey, { response, timestamp: Date.now() });
    // eslint-disable-next-line no-console
    console.log(`[analyzeWallet] Cache MISS for ${trimmed}. Stored.`);

    return response;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[analyzeWallet] Exception for ${trimmed}:`, error);
    throw new Error(
      `Failed to analyze wallet: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Opt-In Network Architecture - Join Network
 * The ONLY write-action. Adds user to database.
 */
export async function joinNetwork(
  address: string,
  username: string,
  walletAnalysis: WalletAnalysis,
  signedMessage?: { message: string; signature: string },
  socialLinks?: SocialLinks,
): Promise<{ success: boolean; message: string }> {
  "use server";

  try {
    // Universal normalization + validation
    const normalizedAddress = normalizeAndValidateSolanaAddress(address);

    // SECURITY (VULN-11): Rate limit joinNetwork by wallet address
    const rateCheck = await checkRateLimit(normalizedAddress, RATE_LIMITS.JOIN_NETWORK.maxRequests, RATE_LIMITS.JOIN_NETWORK.windowMs);
    if (!rateCheck.allowed) {
      return { success: false, message: "Too many join attempts. Please wait before trying again." };
    }

    // SECURITY (VULN-09): Sanitize username — strip HTML, enforce length, allow only safe chars
    const sanitizedUsername = username
      .trim()
      // SECURITY (VULN-11): Strip control chars (null byte \x00, CR, LF, DEL, etc.)
      .replace(/[\x00-\x1f\x7f]/g, "")
      .replace(/[<>"'&]/g, "") // Strip XSS-prone characters
      .slice(0, 32);           // Max 32 chars

    if (sanitizedUsername.length < 1) {
      return { success: false, message: "Invalid username." };
    }

    // SECURITY (VULN-01): Wallet signature is MANDATORY — proves key ownership.
    // Prevents impersonation: anyone could join as any wallet without this check.
    // SECURITY (VULN-07): Timestamp validated to block replay attacks (5-min window).
    if (!signedMessage) {
      return { success: false, message: "Wallet signature is required. Please reconnect your wallet and try again." };
    }

    // SECURITY: Canonical message parsing — anti-phishing & replay protection
    const m = signedMessage.message.match(/^Pump Match (Join|Update|Leave)\r?\nWallet:\s([1-9A-HJ-NP-Za-km-z]{32,44})\r?\nTimestamp:\s(\d{13})$/);
    if (!m) {
      return { success: false, message: "Malformed signature message format." };
    }
    const [, actionType, msgWallet, tsStr] = m;
    if (actionType !== "Join") {
      return { success: false, message: "Signature action mismatch. Expected 'Join'." };
    }
    if (msgWallet !== normalizedAddress) {
      return { success: false, message: "Message wallet does not match target wallet." };
    }
    const parsedTs = Number(tsStr);
    const now = Date.now();
    const TIME_WINDOW_MS = 5 * 60 * 1000;
    const FUTURE_SKEW_MS = 30 * 1000;
    if (!Number.isFinite(parsedTs) || parsedTs > now + FUTURE_SKEW_MS || now - parsedTs > TIME_WINDOW_MS) {
      return { success: false, message: "Signature expired. Please sign again." };
    }

    const isValidSig = await verifyWalletSignature(
      normalizedAddress,
      signedMessage.message,
      signedMessage.signature,
    );
    if (!isValidSig) {
      return { success: false, message: "Signature verification failed. Please reconnect your wallet." };
    }

    if (!walletAnalysis.intent) {
      return {
        success: false,
        message: "Intent is required to join the network",
      };
    }

    // Social links validation
    if (socialLinks) {
      const twitterHandleRegex = /^[a-zA-Z0-9_]{1,15}$/;
      const telegramHandleRegex = /^[a-zA-Z0-9_]{5,32}$/;
      if (socialLinks.twitter && socialLinks.twitter.length > 0 && !twitterHandleRegex.test(socialLinks.twitter)) {
        return { success: false, message: "Invalid Twitter handle." };
      }
      if (socialLinks.telegram && socialLinks.telegram.length > 0 && !telegramHandleRegex.test(socialLinks.telegram)) {
        return { success: false, message: "Invalid Telegram handle." };
      }
    }

    // Security & Stability - Check if user already exists to preserve joinedAt
    const existingUser = await getUserProfile(normalizedAddress);
    const isFirstJoin = !existingUser;
    const joinedAt = existingUser?.joinedAt ?? Date.now(); // Immutable Join Date

    // ── Phase 2: Zombie Resurrection Fix ──
    // Determine user activity state for cooldown logic
    const SLEEPING_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const SOFT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

    if (existingUser) {
      const now = Date.now();
      const timeSinceLastActive = now - existingUser.lastActiveAt;
      const isSleeping = timeSinceLastActive > SLEEPING_THRESHOLD_MS;
      const isRecentlyActive = timeSinceLastActive < SOFT_COOLDOWN_MS;

      if (isSleeping) {
        // GHOST MODE (sleeping > 7 days): Hard Rejoin
        // Treat as if new registration - update lastActiveAt, refresh profile
        // eslint-disable-next-line no-console
        console.log(`[joinNetwork] Ghost user ${normalizedAddress.slice(0, 8)}... performing Hard Rejoin (inactive ${Math.round(timeSinceLastActive / 86400000)}d)`);
        // Fall through to full profile rebuild below
      } else if (isRecentlyActive) {
        // ACTIVE user (< 1 hour): Soft Cooldown - noop
        // eslint-disable-next-line no-console
        console.log(`[joinNetwork] Active user ${normalizedAddress.slice(0, 8)}... Soft Cooldown (last active ${Math.round(timeSinceLastActive / 1000)}s ago)`);
        return {
          success: true,
          message: "You are already an active member. Profile unchanged.",
        };
      }
      // Otherwise (1 hour - 7 days): Normal re-join, update profile
    }

    // Convert WalletAnalysis to UserProfile
    // NOT: Supabase upsertUser fonksiyonu Partial<UserData> kabul eder.
    // Burada tam profil oluşturuyoruz ancak veritabanına sadece schema'ya uygun alanlar gidecek.
    const userProfile: UserProfile = {
      id: existingUser?.id ?? `user_${normalizedAddress.slice(0, 8)}`,
      address: normalizedAddress,
      username: sanitizedUsername,
      role: walletAnalysis.badges.includes("whale")
        ? "Whale"
        : walletAnalysis.tokenDiversity > 10
          ? "Dev"
          : walletAnalysis.nftCount > 5
            ? "Artist"
            : "Community",
      trustScore: walletAnalysis.trustScore,
      tags: existingUser?.tags ?? [], // Preserve existing tags on rejoin
      intent: walletAnalysis.intent,
      socialProof: {
        verified: walletAnalysis.systemScore > 0,
        communityTrusted: walletAnalysis.socialScore > 0,
        endorsements: existingUser?.socialProof.endorsements ?? 0, // Preserve endorsements
      },
      activeBadges: walletAnalysis.badges
        .map((badgeId) => {
          // Map BadgeId to Badge using BADGE_DEFINITIONS
          const def = BADGE_DEFINITIONS[badgeId];
          if (!def) return null;
          return {
            id: badgeId,
            label: def.label,
            category: def.category,
            baseWeight: def.baseWeight,
            icon: def.icon,
          };
        })
        .filter((badge): badge is Badge => badge !== null),
      lastActiveAt: Date.now(),
      isOptedIn: true, // Explicit opt-in
      joinedAt, // Security & Stability - Immutable Join Date (only set on first join)
      identityState: existingUser?.identityState ?? "GHOST", // Preserve identity on rejoin
      matchFilters: existingUser?.matchFilters, // Preserve reciprocity filters
    };

    // Identity state: upgrade to REACHABLE if user provided at least one social link.
    // GHOST → REACHABLE (has social contacts) → VERIFIED (algorithmic, future)
    const hasSocialLinks = !!(socialLinks?.twitter || socialLinks?.telegram);
    const resolvedIdentityState: UserProfile["identityState"] =
      hasSocialLinks && userProfile.identityState !== "VERIFIED"
        ? "REACHABLE"
        : userProfile.identityState;

    // GÜNCELLEME: Veritabanına yaz (Supabase) — tüm profil alanları
    const success = await upsertUser(normalizedAddress, {
        trust_score: userProfile.trustScore,
        level: userProfile.role,
        username: userProfile.username,
        activeBadges: userProfile.activeBadges,
        socialProof: userProfile.socialProof,
        identityState: resolvedIdentityState,
        is_opted_in: true,
        intent: userProfile.intent,
        tags: userProfile.tags,         // Preserve user tags (community interests)
        joined_at: userProfile.joinedAt, // Immutable OG date — only written once due to upsert undefined removal
        social_links: socialLinks,       // Optional Twitter/Telegram handles
    });

    // Not: success UserData | null döner, bu yüzden truthy kontrolü yeterli
    if (success) {
      return {
        success: true,
        message: isFirstJoin
          ? "Successfully joined the network! Welcome to Pump Match."
          : "Profile updated successfully.",
      };
    } else {
      return {
        success: false,
        message: "Failed to join network. Please ensure you have opted in.",
      };
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[joinNetwork] Exception for ${address.slice(0, 12)}:`, error);
    return {
      success: false,
      message: `Failed to join network: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Opt-In Network Architecture - Get Network Matches
 * Only accessible to registered users. Fetches from DB.
 * Security & Stability - Snapshot Logic: 5-minute cache to prevent probing
 */
export async function getNetworkMatches(
  userAddress: string,
  userWalletAnalysis: WalletAnalysis,
): Promise<MatchProfile[]> {
  "use server";

  try {
    const { calculateMatchScore } = await import("@/lib/match-engine");

    // Get user profile to check cache
    const user = await getUserProfile(userAddress);
    if (!user) {
      return []; // Not registered
    }

    // SECURITY (VULN-05): Override client-provided analysis with DB-authoritative values.
    // Prevents trust score / badge spoofing to manipulate match results.
    // solBalance / tokenDiversity / nftCount are NOT stored in DB (on-chain only),
    // so we override the two most impactful fields: trustScore and badges.
    const serverVerifiedAnalysis: WalletAnalysis = {
      ...userWalletAnalysis,
      trustScore: user.trustScore,
      score: user.trustScore,
      badges: user.activeBadges.map((b) => b.id as BadgeId),
    };

    // Security & Stability - Snapshot Logic: Check if cache is still valid (5 minutes)
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const cacheAge = user.lastMatchSnapshotAt
      ? now - user.lastMatchSnapshotAt
      : Infinity;

    if (user.cachedMatches && cacheAge < CACHE_TTL_MS) {
      // Return cached matches (Anti-Probing)
      // eslint-disable-next-line no-console
      console.log(
        `[getNetworkMatches] Returning cached matches for ${userAddress} (age: ${Math.round(cacheAge / 1000)}s)`,
      );
      return user.cachedMatches;
    }

    // Cache expired or doesn't exist - Calculate fresh matches
    const registeredUsers = await findMatches(userAddress, 20);

    if (registeredUsers.length === 0) {
      return []; // No matches found
    }

    // Endorsement system: Batch-fetch counts + "endorsed by me" flags (2 queries total)
    const matchAddresses = registeredUsers.map((u) => u.address);
    const [endorsementCountMap, myEndorsedSet] = await Promise.all([
      getEndorsementCounts(matchAddresses),
      getMyEndorsements(userAddress, matchAddresses),
    ]);

    // Convert UserProfile[] to MatchProfile[] using match engine
    // Phase 1: Pass matchFilters and lastActiveAt for reciprocity & time decay
    const matchProfiles: MatchProfile[] = registeredUsers
      .map((matchUser) => {
        const { confidence, reason, breakdown, matchReasons } = calculateMatchScore(
          serverVerifiedAnalysis,
          {
            id: matchUser.id,
            username: matchUser.username,
            role: matchUser.role,
            trustScore: matchUser.trustScore,
            tags: matchUser.tags,
            intent: matchUser.intent,
            // Phase 1: Reciprocity - pass match filters for hard reject check
            matchFilters: matchUser.matchFilters,
            // Phase 1: Time Decay - pass lastActiveAt for activity multiplier
            lastActiveAt: matchUser.lastActiveAt,
          },
          matchUser.socialProof,
          matchUser.activeBadges,
        );

        // Phase 1: Hard Reject - if reciprocity check failed, skip this match
        if (confidence === 0 && matchReasons.some((r) => r.code === "TRUST_THRESHOLD_MISMATCH")) {
          return null;
        }

        // Calculate system score for sorting
        const systemScore = matchUser.activeBadges
          .filter((b) => b.category === "SYSTEM")
          .reduce((sum, badge) => sum + badge.baseWeight, 0);

        return {
          id: matchUser.id,
          address: matchUser.address,
          username: matchUser.username,
          role: matchUser.role,
          trustScore: matchUser.trustScore,
          tags: matchUser.tags,
          matchReason: reason,
          matchConfidence: confidence,
          socialProof: matchUser.socialProof,
          activeBadges: matchUser.activeBadges,
          confidenceBreakdown: breakdown,
          intent: matchUser.intent,
          identityState: matchUser.identityState ?? "GHOST",
          matchReasons,
          socialLinks: matchUser.socialLinks,
          // Endorsement system
          endorsementCount: endorsementCountMap.get(matchUser.address) ?? 0,
          isEndorsedByMe: myEndorsedSet.has(matchUser.address),
          // Internal sorting helpers (will be removed before return)
          _systemScore: systemScore,
          _isVerified: matchUser.identityState === "VERIFIED",
        } as MatchProfile & { _systemScore: number; _isVerified: boolean };
      })
      .filter((profile): profile is MatchProfile & { _systemScore: number; _isVerified: boolean } => profile !== null);

    // Identity Hierarchy & Sorting: Match Score > Verified Priority > System Score
    matchProfiles.sort((a, b) => {
      const aProfile = a as MatchProfile & { _systemScore: number; _isVerified: boolean };
      const bProfile = b as MatchProfile & { _systemScore: number; _isVerified: boolean };

      // 1. PRIMARY: Match Score (highest first)
      if (Math.abs(aProfile.matchConfidence - bProfile.matchConfidence) > 2) {
        return bProfile.matchConfidence - aProfile.matchConfidence;
      }

      // 2. TIE-BREAKER: Verified priority when scores are close
      if (aProfile._isVerified !== bProfile._isVerified) {
        return aProfile._isVerified ? -1 : 1;
      }

      // 3. FINAL TIE-BREAKER: System Score (on-chain)
      return bProfile._systemScore - aProfile._systemScore;
    });

    // Remove internal sorting helpers before returning
    const cleanedProfiles: MatchProfile[] = matchProfiles.map((profile) => {
      const { _systemScore, _isVerified, ...cleanProfile } = profile as MatchProfile & {
        _systemScore: number;
        _isVerified: boolean;
      };
      return cleanProfile;
    });

    // Security & Stability - Update cache snapshot (fire-and-forget with error handling)
    updateMatchSnapshot(userAddress, cleanedProfiles).catch((err) =>
      // eslint-disable-next-line no-console
      console.error("[getNetworkMatches] Failed to update match snapshot:", err),
    );
    // eslint-disable-next-line no-console
    console.log(
      `[getNetworkMatches] Calculated fresh matches for ${userAddress} and cached snapshot`,
    );

    return cleanedProfiles;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[getNetworkMatches] Exception for ${userAddress}:`, error);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// God Mode Discovery: Search Network Action (READ-ONLY)
// ──────────────────────────────────────────────────────────────

import type { NetworkAgent, SearchFilters } from "@/types";

/**
 * God Mode Discovery - Search the network with filters.
 * Pure READ operation, no side effects.
 * AND logic: all badge filters must match simultaneously.
 */
export async function searchNetworkAction(
  filters: SearchFilters,
): Promise<NetworkAgent[]> {
  "use server";

  try {
    // SECURITY (VULN-06): Rate limit by client IP — prevents full-network enumeration.
    // RATE_LIMITS.SEARCH_NETWORK was defined but never applied before this fix.
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headersList.get("x-real-ip") ??
      "unknown";
    const rateCheck = await checkRateLimit(
      `search:${ip}`,
      RATE_LIMITS.SEARCH_NETWORK.maxRequests,
      RATE_LIMITS.SEARCH_NETWORK.windowMs,
    );
    if (!rateCheck.allowed) {
      return [];
    }

    const { searchNetwork } = await import("@/lib/db");
    return searchNetwork(filters);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[searchNetworkAction] Exception:`, error);
    return [];
  }
}

/**
 * Update profile fields without requiring a full WalletAnalysis re-fetch.
 * Lighter than joinNetwork — only updates username, tags, intent, socialLinks.
 * Requires signature to prevent unauthorized edits.
 */
export async function updateProfileAction(
  address: string,
  updates: {
    username?: string;
    tags?: string[];
    intent?: UserIntent;
    socialLinks?: SocialLinks;
  },
  signedMessage: { message: string; signature: string },
): Promise<{ success: boolean; message: string }> {
  "use server";

  try {
    const trimmed = normalizeAndValidateSolanaAddress(address);

    // SECURITY: Canonical message parsing — anti-phishing & replay protection
    const m = signedMessage.message.match(/^Pump Match (Join|Update|Leave)\r?\nWallet:\s([1-9A-HJ-NP-Za-km-z]{32,44})\r?\nTimestamp:\s(\d{13})$/);
    if (!m) {
      return { success: false, message: "Malformed signature message format." };
    }
    const [, actionType, msgWallet, tsStr] = m;
    if (actionType !== "Update") {
      return { success: false, message: "Signature action mismatch. Expected 'Update'." };
    }
    if (msgWallet !== trimmed) {
      return { success: false, message: "Message wallet does not match target wallet." };
    }
    const parsedTs = Number(tsStr);
    const now = Date.now();
    const TIME_WINDOW_MS = 5 * 60 * 1000;
    const FUTURE_SKEW_MS = 30 * 1000;
    if (!Number.isFinite(parsedTs) || parsedTs > now + FUTURE_SKEW_MS || now - parsedTs > TIME_WINDOW_MS) {
      return { success: false, message: "Signature expired. Please try again." };
    }

    const isValidSig = await verifyWalletSignature(trimmed, signedMessage.message, signedMessage.signature);
    if (!isValidSig) {
      return { success: false, message: "Signature verification failed." };
    }

    // Must be opted-in
    const existing = await getUserProfile(trimmed);
    if (!existing?.isOptedIn) {
      return { success: false, message: "You must be a network member to update your profile." };
    }

    const upsertData: Parameters<typeof upsertUser>[1] = {};

    // Username: sanitize (same rules as joinNetwork)
    if (updates.username !== undefined) {
      const sanitized = updates.username
        .trim()
        .replace(/[\x00-\x1f\x7f]/g, "")
        .replace(/[<>"'&]/g, "")
        .slice(0, 32);
      if (sanitized.length < 1) {
        return { success: false, message: "Invalid username." };
      }
      upsertData.username = sanitized;
    }

    // Tags: max 10, each max 20 chars, strip XSS-prone chars
    if (updates.tags !== undefined) {
      upsertData.tags = updates.tags
        .map((t) => t.trim().replace(/[<>"'&]/g, "").slice(0, 20))
        .filter(Boolean)
        .slice(0, 10);
    }

    // Intent: validated against known enum values
    if (updates.intent !== undefined) {
      const VALID_INTENTS: UserIntent[] = [
        "BUILD_SQUAD",
        "FIND_FUNDING",
        "HIRE_TALENT",
        "JOIN_PROJECT",
        "NETWORK",
      ];
      if (!VALID_INTENTS.includes(updates.intent)) {
        return { success: false, message: "Invalid intent value." };
      }
      upsertData.intent = updates.intent;
    }

    // Social links: validate Twitter and Telegram handles
    if (updates.socialLinks !== undefined) {
      const { twitter, telegram } = updates.socialLinks;
      // Twitter/X: alphanumeric + underscore, 1-15 chars
      const twitterHandleRegex = /^[a-zA-Z0-9_]{1,15}$/;
      // Telegram: alphanumeric + underscore, 5-32 chars
      const telegramHandleRegex = /^[a-zA-Z0-9_]{5,32}$/;

      if (twitter !== undefined && twitter.length > 0 && !twitterHandleRegex.test(twitter)) {
        return { success: false, message: "Invalid Twitter handle. Use only letters, numbers, and underscores (max 15 chars)." };
      }
      if (telegram !== undefined && telegram.length > 0 && !telegramHandleRegex.test(telegram)) {
        return { success: false, message: "Invalid Telegram handle. Use only letters, numbers, and underscores (5-32 chars)." };
      }
      upsertData.social_links = updates.socialLinks;

      // Identity upgrade: GHOST → REACHABLE when user provides at least one social link
      const hasSocialLinks = !!(twitter || telegram);
      if (hasSocialLinks && existing.identityState !== "VERIFIED") {
        upsertData.identityState = "REACHABLE";
      }
      // Downgrade: if user clears all social links, revert to GHOST (unless VERIFIED)
      if (!hasSocialLinks && existing.identityState === "REACHABLE") {
        upsertData.identityState = "GHOST";
      }
    }

    if (Object.keys(upsertData).length === 0) {
      return { success: false, message: "Nothing to update." };
    }

    const result = await upsertUser(trimmed, upsertData);
    if (!result) {
      return { success: false, message: "Failed to update profile." };
    }

    return { success: true, message: "Profile updated successfully." };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[updateProfileAction] Exception:`, error);
    return { success: false, message: "Update failed. Please try again." };
  }
}

/**
 * Endorse a network member. Proves key ownership via Ed25519 signature.
 * Zirhli: message format + timestamp + trust score 50+ gerekli.
 */
export async function endorseUserAction(
  fromWallet: string,
  toWallet: string,
  signedMessage: { message: string; signature: string },
): Promise<{ success: boolean; message: string; alreadyEndorsed?: boolean }> {
  "use server";

  try {
    const fromParam = normalizeAndValidateSolanaAddress(fromWallet);
    const toParam = normalizeAndValidateSolanaAddress(toWallet);
    if (fromParam === toParam) return { success: false, message: "You cannot endorse yourself." };

    const m = signedMessage.message.match(
      /^Pump Match Endorse\r?\nTarget:\s([1-9A-HJ-NP-Za-km-z]{32,44})\r?\nFrom:\s([1-9A-HJ-NP-Za-km-z]{32,44})\r?\nTimestamp:\s(\d{13})$/
    );
    if (!m) return { success: false, message: "Malformed signature message." };

    const [, msgTarget, msgFrom, tsStr] = m;
    const ts = Number(tsStr);

    if (msgFrom !== fromParam || msgTarget !== toParam) {
      return { success: false, message: "Message does not match parameters (tampering)." };
    }

    const now = Date.now();
    const TIME_WINDOW_MS = 5 * 60 * 1000;
    const FUTURE_SKEW_MS = 30 * 1000;
    if (!Number.isFinite(ts) || ts > now + FUTURE_SKEW_MS || now - ts > TIME_WINDOW_MS) {
      return { success: false, message: "Signature expired or timestamp invalid." };
    }

    const isValidSig = await verifyWalletSignature(fromParam, signedMessage.message, signedMessage.signature);
    if (!isValidSig) return { success: false, message: "Signature verification failed." };

    const fromProfile = await getUserProfile(fromParam);
    if (!fromProfile?.isOptedIn) return { success: false, message: "You must join the network before endorsing." };
    if ((fromProfile.trustScore ?? 0) < 50) return { success: false, message: "Security Block: Trust Score 50+ required to endorse." };

    const toProfile = await getUserProfile(toParam);
    if (!toProfile?.isOptedIn) return { success: false, message: "Target wallet is not a network member." };

    const dayBucket = new Date().toISOString().slice(0, 10);
    const redis = getRedisClient();
    const doneKey = `endorse:done:${fromParam}:${toParam}`;
    const lockKey = `endorse:lock:${fromParam}:${toParam}`;

    if (redis) {
      const already = await redis.get(doneKey);
      if (already) return { success: true, message: "Already endorsed this user.", alreadyEndorsed: true };

      const locked = await redis.set(lockKey, "1", { nx: true, ex: 15 });
      if (!locked) return { success: false, message: "Request processing. Try again in 15 seconds." };
    }

    try {
      const rateCheck = await checkRateLimit(
        `endorse:${fromParam}:${dayBucket}`,
        RATE_LIMITS.ENDORSE.maxRequests,
        RATE_LIMITS.ENDORSE.windowMs
      );
      if (!rateCheck.allowed) return { success: false, message: "Endorsement limit reached (5/day)." };

      const result = await addEndorsement(fromParam, toParam);
      if (result.alreadyEndorsed) {
        if (redis) await redis.set(doneKey, "1", { ex: 90 * 24 * 60 * 60 });
        return { success: true, message: "Already endorsed this user.", alreadyEndorsed: true };
      }
      if (!result.success) return { success: false, message: "Failed to record endorsement. Please try again." };

      if (redis) await redis.set(doneKey, "1", { ex: 90 * 24 * 60 * 60 });

      const newCount = await getEndorsementCount(toParam);
      await upsertUser(toParam, {
        socialProof: {
          ...toProfile.socialProof,
          endorsements: newCount,
          communityTrusted: newCount >= 3,
        },
      });

      return { success: true, message: `Successfully endorsed ${toProfile.username}!`, alreadyEndorsed: false };
    } finally {
      if (redis) await redis.del(lockKey);
    }
  } catch (error) {
    return { success: false, message: "Endorsement failed. Please try again." };
  }
}

/**
 * Get user profile by wallet address.
 * Returns the user profile if found, or null if not registered.
 */
export async function getUserAction(address: string): Promise<UserProfile | null> {
  "use server";

  try {
    const normalizedAddr = normalizeAndValidateSolanaAddress(address);
    return await getUserProfile(normalizedAddr);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[getUserAction] Exception for ${address.slice(0, 12)}:`, error);
    return null;
  }
}

/**
 * GDPR Opt-Out: Leave the Pump Match Network.
 * - Requires valid wallet signature to prevent CSRF
 * - Anonymizes: username → "Anon", clears social_links, tags, cached_matches
 * - Sets is_opted_in = false (user disappears from search and matchmaking)
 * - Row is kept for trust_score audit trail; wallet can re-join later
 */
export async function leaveNetworkAction(
  address: string,
  signedMessage: { message: string; signature: string },
): Promise<{ success: boolean; message: string }> {
  "use server";

  try {
    const trimmed = normalizeAndValidateSolanaAddress(address);

    // SECURITY: Canonical message parsing — anti-phishing & replay protection
    const m = signedMessage.message.match(/^Pump Match (Join|Update|Leave)\r?\nWallet:\s([1-9A-HJ-NP-Za-km-z]{32,44})\r?\nTimestamp:\s(\d{13})$/);
    if (!m) {
      return { success: false, message: "Malformed signature message format." };
    }
    const [, actionType, msgWallet, tsStr] = m;
    if (actionType !== "Leave") {
      return { success: false, message: "Signature action mismatch. Expected 'Leave'." };
    }
    if (msgWallet !== trimmed) {
      return { success: false, message: "Message wallet does not match target wallet." };
    }
    const parsedTs = Number(tsStr);
    const now = Date.now();
    const TIME_WINDOW_MS = 5 * 60 * 1000;
    const FUTURE_SKEW_MS = 30 * 1000;
    if (!Number.isFinite(parsedTs) || parsedTs > now + FUTURE_SKEW_MS || now - parsedTs > TIME_WINDOW_MS) {
      return { success: false, message: "Signature expired. Please try again." };
    }

    const isValidSig = await verifyWalletSignature(trimmed, signedMessage.message, signedMessage.signature);
    if (!isValidSig) {
      return { success: false, message: "Signature verification failed." };
    }

    const existing = await getUserProfile(trimmed);
    if (!existing?.isOptedIn) {
      return { success: false, message: "You are not currently a network member." };
    }

    const ok = await leaveNetwork(trimmed);
    if (!ok) {
      return { success: false, message: "Failed to process opt-out. Please try again." };
    }

    return { success: true, message: "You have left the network. Your data has been anonymized." };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[leaveNetworkAction] Exception for ${address.slice(0, 12)}:`, error);
    return { success: false, message: "Opt-out failed. Please try again." };
  }
}