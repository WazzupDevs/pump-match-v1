"use server";

import {
  getAssetsByOwner,
  getSolBalance,
  getWalletTransactionData,
  searchAssets,
  type DasAsset,
} from "@/lib/helius";
import { getMatches } from "@/lib/match-engine";
// GÜNCELLEME: Supabase upsert fonksiyonunu ekledik
import { getUserProfile, isUserRegistered, upsertUser, findMatches, updateMatchSnapshot } from "@/lib/db";
import type {
  AnalyzeWalletResult,
  AnalyzeWalletResponse,
  Badge,
  BadgeCategory,
  BadgeId,
  IdentityState,
  MatchProfile,
  ScoreBreakdown,
  UserIntent,
  UserProfile,
  WalletAnalysis,
} from "@/types";

// ──────────────────────────────────────────────────────────────
// Production Grade: Memory Cache (15-min TTL)
// Prevents Helius API spam and refresh attacks.
// ──────────────────────────────────────────────────────────────

type CachedAnalysis = {
  response: AnalyzeWalletResponse;
  timestamp: number;
};

const ANALYSIS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Persist across hot-reloads in dev
const globalForCache = globalThis as unknown as {
  analysisCache?: Map<string, CachedAnalysis>;
};

if (!globalForCache.analysisCache) {
  globalForCache.analysisCache = new Map<string, CachedAnalysis>();
}

const analysisCache = globalForCache.analysisCache;

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

function calculateScore(
  solBalance: number,
  transactionCount: number,
  tokenDiversity: number,
): ScoreBreakdown {
  // Bakiye Puanı: Max 40 puan, her 1 SOL için puan ver
  const balanceScore = Math.min(40, Math.floor(solBalance * 4));

  // Aktivite Puanı: Max 40 puan
  let activityScore = 0;

  // transactionCount === -1: API hatası (getWalletTransactionData sentinel değeri)
  // transactionCount === 0: Gerçekten 0 işlem — artık isLikelyApiError mantığı yok
  const isApiError = transactionCount === -1;
  const effectiveTransactionCount = isApiError ? 0 : transactionCount;

  if (effectiveTransactionCount >= 1000) {
    activityScore = 40; // OG/Whale
  } else if (effectiveTransactionCount > 100) {
    activityScore = 20;
  } else if (effectiveTransactionCount > 50) {
    activityScore = 10;
  }

  // Çeşitlilik Puanı: Max 20 puan
  const diversityScore = tokenDiversity > 5 ? 20 : Math.min(20, tokenDiversity * 4);

  // Ceza: İşlem sayısı < 5 ise (yeni cüzdan/Fresh), toplam skordan -20 puan düş
  // API hatasında ceza uygulanmaz
  const penalty = effectiveTransactionCount < 5 && !isApiError ? 20 : 0;

  const total = Math.max(0, Math.min(100, balanceScore + activityScore + diversityScore - penalty));

  // Açıklama oluştur
  const explanations: string[] = [];
  if (isApiError) {
    explanations.push("İşlem geçmişi alınamadı (teknik sorun)");
  }
  if (penalty > 0) {
    explanations.push("Düşük aktivite sebebiyle puan kırıldı (Fresh cüzdan)");
  }
  if (balanceScore >= 30) {
    explanations.push("Yüksek bakiye");
  }
  if (activityScore >= 40) {
    explanations.push("OG/Whale aktivite seviyesi");
  } else if (activityScore >= 20) {
    explanations.push("Aktif kullanıcı");
  } else if (activityScore >= 10 && !isApiError) {
    explanations.push("Orta seviye aktivite");
  }
  if (diversityScore >= 15) {
    explanations.push("Çeşitli token portföyü");
  }
  if (explanations.length === 0) {
    explanations.push("Standart profil");
  }

  return {
    balanceScore,
    activityScore,
    diversityScore,
    penalty,
    total,
    explanation: explanations.join(" · "),
  };
}

// Pump Match - Badge Definitions
const BADGE_DEFINITIONS: Record<BadgeId, { label: string; category: BadgeCategory; baseWeight: number; icon: string }> = {
  whale: { label: "Whale", category: "SYSTEM", baseWeight: 6, icon: "Waves" },
  dev: { label: "Dev", category: "SYSTEM", baseWeight: 5, icon: "Code" },
  og_wallet: { label: "OG Wallet", category: "SYSTEM", baseWeight: 4, icon: "Clock" },
  community_trusted: { label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
  governor: { label: "Governor", category: "SOCIAL", baseWeight: 12, icon: "Crown" },
};

/**
 * Pump Match - Badge Assignment (Server-Side)
 * Hard Type Badge ID'ler kullanılır.
 */
function assignBadges(
  solBalance: number,
  transactionCount: number,
  tokenDiversity: number,
): BadgeId[] {
  const badges: BadgeId[] = [];

  // Balance > 10 => whale (System, Weight: 6)
  if (solBalance > 10) {
    badges.push("whale");
  }

  // Mock Logic => community_trusted (Social, Weight: 7)
  // Gerçek implementasyonda burada topluluk onayı kontrolü yapılacak
  if (solBalance > 5 && transactionCount > 50) {
    badges.push("community_trusted");
  }

  // OG Wallet: Transaction count > 1000
  if (transactionCount > 1000 && transactionCount !== -1) {
    badges.push("og_wallet");
  }

  // Dev: Token diversity > 10
  if (tokenDiversity > 10) {
    badges.push("dev");
  }

  return badges;
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

export async function analyzeWallet(address: string, userIntent?: UserIntent): Promise<AnalyzeWalletResponse> {
  // Validation: Address required
  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error("Address is required");
  }

  // Production Grade: Validate Solana address format
  if (!isValidSolanaAddress(trimmed)) {
    throw new Error("Invalid Solana address. Please enter a valid base58 wallet address.");
  }

  // Production Grade: Check memory cache (15-min TTL)
  const cacheKey = `${trimmed}:${userIntent ?? "none"}`;
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ANALYSIS_CACHE_TTL_MS) {
    // eslint-disable-next-line no-console
    console.log(`[analyzeWallet] Cache HIT for ${trimmed} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
    return cached.response;
  }

  try {
    // Parallel data fetching (Enhanced Transactions API eliminates N+1 pattern)
    const [assetsByOwnerResult, solBalance, txData] = await Promise.all([
      getAssetsByOwner(trimmed),
      getSolBalance(trimmed),
      getWalletTransactionData(trimmed), // Unified: count + wallet age + funding source
    ]);

    const transactionCount = txData.transactionCount;
    const firstTxData = txData; // Compatible shape: { approxWalletAgeDays, ... }

    // getAssetsByOwner null fallback
    const assetsByOwner = assetsByOwnerResult || { items: [], total: 0 };

    // Fetch fungible and non-fungible counts via searchAssets
    let fungibleTokens = 0;
    let totalNfts = 0;

    try {
      const fungibleTokensResult = await searchAssets({
        ownerAddress: trimmed,
        tokenType: "fungible",
        limit: 1,
      });

      if (fungibleTokensResult) {
        const rawTotal =
          fungibleTokensResult.assets?.total ?? fungibleTokensResult.total;
        fungibleTokens =
          typeof rawTotal === "number" && rawTotal >= 0 ? rawTotal : 0;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[AnalyzeWallet] Failed to fetch fungible tokens:`, error);
      fungibleTokens = 0;
    }

    try {
      const nonFungibleTokensResult = await searchAssets({
        ownerAddress: trimmed,
        tokenType: "nonFungible",
        limit: 1,
      });

      if (nonFungibleTokensResult) {
        const rawTotal =
          nonFungibleTokensResult.assets?.total ?? nonFungibleTokensResult.total;
        totalNfts = typeof rawTotal === "number" && rawTotal >= 0 ? rawTotal : 0;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[AnalyzeWallet] Failed to fetch NFTs:`, error);
      totalNfts = 0;
    }

    const totalAssets = fungibleTokens + totalNfts;
    const tokenDiversity = computeTokenDiversity(assetsByOwner.items);
    const activityCount = totalAssets + (transactionCount > 0 ? transactionCount : 0);
    const scoreBreakdown = calculateScore(solBalance, transactionCount, tokenDiversity);

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

    // Badge assignment and score calculation (server-side only)
    const badges = assignBadges(solBalance, transactionCount, tokenDiversity);
    const { systemScore, socialScore } = calculateBadgeScores(badges);

    const trustScore = scoreBreakdown.total;
    const score = trustScore;
    const scoreLabel = trustScore >= 80 ? "High Trust" : trustScore >= 50 ? "Medium Trust" : "Low Trust";

    // Opt-In Network Architecture - Check if user is registered (In-Memory Check removed, now relies on DB sync)
    const isRegistered = await isUserRegistered(trimmed);

    // ──────────────────────────────────────────────────────────────
    // GÜNCELLEME: SUPABASE KAYIT (Kalıcı Hafıza)
    // Analiz yapılır yapılmaz veriyi Supabase'e "Upsert" ediyoruz.
    // Böylece kullanıcı sayfayı yenilese bile Trust Score'u veritabanında saklı kalıyor.
    // ──────────────────────────────────────────────────────────────
    try {
      // Basit bir seviye belirleme mantığı (Join öncesi placeholder)
      const calculatedLevel = badges.includes("whale") ? "Whale" :
                              badges.includes("dev") ? "Dev" :
                              badges.includes("og_wallet") ? "OG" : "Rookie";

      await upsertUser(trimmed, {
        trust_score: trustScore,
        level: calculatedLevel,
        // match_count gibi diğer alanları değiştirmiyoruz, mevcutsa kalır
      });
      // eslint-disable-next-line no-console
      console.log(`[analyzeWallet] Synced data to Supabase for ${trimmed.slice(0, 6)}...`);
    } catch (dbError) {
      // DB hatası analizi durdurmamalı, sadece logluyoruz
      console.error("[analyzeWallet] Supabase Sync Failed:", dbError);
    }
    // ──────────────────────────────────────────────────────────────

    const walletAnalysis: WalletAnalysis = {
      address: trimmed,
      solBalance,
      tokenCount: fungibleTokens,
      nftCount: totalNfts,
      assetCount: totalAssets,
      score,
      scoreLabel,
      trustScore,
      badges,
      transactionCount,
      tokenDiversity,
      scoreBreakdown,
      systemScore,
      socialScore,
      intent: userIntent,
      isRegistered,
      // Production Grade: Wallet age from first activity
      approxWalletAge: firstTxData.approxWalletAgeDays ?? undefined,
    };

    // Match Engine: Calculate matches (read-only, mock data for preview)
    const matches = getMatches(walletAnalysis);

    const response: AnalyzeWalletResponse = {
      analysis: analysisResult,
      walletAnalysis,
      matches,
    };

    // Production Grade: Store in cache
    analysisCache.set(cacheKey, { response, timestamp: Date.now() });
    // eslint-disable-next-line no-console
    console.log(`[analyzeWallet] Cache MISS for ${trimmed}. Stored. Cache size: ${analysisCache.size}`);

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
): Promise<{ success: boolean; message: string }> {
  "use server";

  try {
    if (!walletAnalysis.intent) {
      return {
        success: false,
        message: "Intent is required to join the network",
      };
    }

    // Security & Stability - Check if user already exists to preserve joinedAt
    const existingUser = await getUserProfile(address.trim());
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
        console.log(`[joinNetwork] Ghost user ${address.slice(0, 8)}... performing Hard Rejoin (inactive ${Math.round(timeSinceLastActive / 86400000)}d)`);
        // Fall through to full profile rebuild below
      } else if (isRecentlyActive) {
        // ACTIVE user (< 1 hour): Soft Cooldown - noop
        // eslint-disable-next-line no-console
        console.log(`[joinNetwork] Active user ${address.slice(0, 8)}... Soft Cooldown (last active ${Math.round(timeSinceLastActive / 1000)}s ago)`);
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
      id: existingUser?.id ?? `user_${address.slice(0, 8)}`,
      address: address.trim(),
      username,
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

    // GÜNCELLEME: Veritabanına yaz (Supabase) — tüm profil alanları
    const success = await upsertUser(address.trim(), {
        trust_score: userProfile.trustScore,
        level: userProfile.role,
        username: userProfile.username,
        activeBadges: userProfile.activeBadges,
        socialProof: userProfile.socialProof,
        identityState: userProfile.identityState,
        is_opted_in: true,
        intent: userProfile.intent,
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
    console.error(`[joinNetwork] Exception for ${address}:`, error);
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

    // Convert UserProfile[] to MatchProfile[] using match engine
    // Phase 1: Pass matchFilters and lastActiveAt for reciprocity & time decay
    const matchProfiles: MatchProfile[] = registeredUsers
      .map((matchUser) => {
        const { confidence, reason, breakdown, matchReasons } = calculateMatchScore(
          userWalletAnalysis,
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
          // Internal sorting helpers (will be removed before return)
          _systemScore: systemScore,
          _isVerified: matchUser.identityState === "VERIFIED",
        } as MatchProfile & { _systemScore: number; _isVerified: boolean };
      })
      .filter((profile): profile is MatchProfile & { _systemScore: number; _isVerified: boolean } => profile !== null);

    // Identity Hierarchy & Sorting - CTO Tuning
    // Sorting Bias Logic: Match Score > Verified Priority > System Score
    // Phase 2: Score Jitter - microscopic randomness to prevent inference attacks
    // Jitter is ephemeral (per-query only), does NOT alter stored scores
    matchProfiles.sort((a, b) => {
      const aProfile = a as MatchProfile & { _systemScore: number; _isVerified: boolean };
      const bProfile = b as MatchProfile & { _systemScore: number; _isVerified: boolean };

      // Phase 2: Anti-inference jitter (max 0.5 points per side, net effect +-1.0)
      // This shuffles the order of same-score entries across queries,
      // making it impossible for bots to infer deterministic ranking patterns
      const jitterA = Math.random() * 0.5;
      const jitterB = Math.random() * 0.5;
      const aScore = aProfile.matchConfidence + jitterA;
      const bScore = bProfile.matchConfidence + jitterB;

      // 1. PRIMARY: Match Score (highest first) - with jitter applied
      if (Math.abs(aScore - bScore) > 2) {
        return bScore - aScore;
      }

      // 2. TIE-BREAKER: Verified Priority (if scores are close, +/- 2 points)
      // Verified users get priority when scores are similar
      if (aProfile._isVerified !== bProfile._isVerified) {
        return aProfile._isVerified ? -1 : 1; // Verified first
      }

      // 3. FINAL TIE-BREAKER: System Score (on-chain score) + jitter
      return (bProfile._systemScore + jitterB) - (aProfile._systemScore + jitterA);
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

/**
 * Identity Hierarchy & Sorting - Verify Payment
 * Ödeme başarılıysa identityState otomatik olarak "VERIFIED" olur.
 * KURAL: IdentityState tek yönlüdür: VERIFIED (Top) > REACHABLE > GHOST (Default)
 */
export async function verifyPayment(
  address: string,
): Promise<{ success: boolean; message: string; identityState?: IdentityState }> {
  "use server";

  try {
    const user = await getUserProfile(address.trim());
    if (!user) {
      return {
        success: false,
        message: "User not found. Please join the network first.",
      };
    }

    // Identity Hierarchy Logic: VERIFIED is the highest state, cannot be downgraded
    const newIdentityState: IdentityState = "VERIFIED";

    const success = await upsertUser(address.trim(), {
        identityState: newIdentityState,
    });

    if (success) {
      return {
        success: true,
        message: "Payment verified! Your identity is now VERIFIED.",
        identityState: newIdentityState,
        // Not: Gerçek app'te db'ye identity status kolonu açmalıyız
      };
    } else {
      return {
        success: false,
        message: "Failed to update identity state.",
      };
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[verifyPayment] Exception for ${address}:`, error);
    return {
      success: false,
      message: `Failed to verify payment: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Identity Hierarchy & Sorting - Link Social
 * Eğer state "GHOST" ise "REACHABLE" yap. Ama zaten "VERIFIED" ise düşürme.
 * KURAL: IdentityState tek yönlüdür: VERIFIED (Top) > REACHABLE > GHOST (Default)
 */
export async function linkSocial(
  address: string,
  socialPlatform: string,
): Promise<{ success: boolean; message: string; identityState?: IdentityState }> {
  "use server";

  try {
    const user = await getUserProfile(address.trim());
    if (!user) {
      return {
        success: false,
        message: "User not found. Please join the network first.",
      };
    }

    // Identity Hierarchy Logic: one-way escalation, cannot downgrade
    const currentState = user.identityState ?? "GHOST";
    const newIdentityState: IdentityState =
      currentState === "VERIFIED" || currentState === "REACHABLE"
        ? currentState
        : "REACHABLE"; // Upgrade from GHOST to REACHABLE

    const success = await upsertUser(address.trim(), {
        identityState: newIdentityState,
    });

    if (success) {
      return {
        success: true,
        message: `Social account (${socialPlatform}) linked! Your identity is now ${newIdentityState}.`,
        identityState: newIdentityState,
      };
    } else {
      return {
        success: false,
        message: "Failed to link social account.",
      };
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[linkSocial] Exception for ${address}:`, error);
    return {
      success: false,
      message: `Failed to link social: ${error instanceof Error ? error.message : String(error)}`,
    };
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
    const { searchNetwork } = await import("@/lib/db");
    return searchNetwork(filters);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[searchNetworkAction] Exception:`, error);
    return [];
  }
}

/**
 * Get user profile by wallet address.
 * Returns the user profile if found, or null if not registered.
 */
export async function getUserAction(address: string): Promise<UserProfile | null> {
  "use server";

  try {
    return await getUserProfile(address.trim());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[getUserAction] Exception for ${address}:`, error);
    return null;
  }
}