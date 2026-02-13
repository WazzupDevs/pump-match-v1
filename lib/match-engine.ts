import "server-only";

import type { Badge, BadgeCategory, ConfidenceBreakdown, MatchProfile, MatchReason, SocialProof, UserIntent, WalletAnalysis } from "@/types";

// Pump Match - Badge Definitions
const BADGE_DEFINITIONS: Record<string, { label: string; category: BadgeCategory; baseWeight: number; icon: string }> = {
  whale: { label: "Whale", category: "SYSTEM", baseWeight: 6, icon: "Waves" },
  dev: { label: "Dev", category: "SYSTEM", baseWeight: 5, icon: "Code" },
  og_wallet: { label: "OG Wallet", category: "SYSTEM", baseWeight: 4, icon: "Clock" },
  community_trusted: { label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
  governor: { label: "Governor", category: "SOCIAL", baseWeight: 12, icon: "Crown" },
};

/**
 * Production Grade: Age Bracket Score
 * Wallet age is NOT added raw. It goes through brackets:
 *   < 7 days:    0   points (Fresh / Suspicious)
 *   7-30 days:   0.5 points (New but alive)
 *   30-180 days: 1   point  (Established)
 *   180+ days:   2   points (OG Status)
 *
 * Label: "First Activity Detected" (NOT "Creation Date")
 */
export function calculateAgeBracketScore(approxWalletAgeDays: number | null | undefined): number {
  if (approxWalletAgeDays == null || approxWalletAgeDays < 7) return 0;
  if (approxWalletAgeDays < 30) return 0.5;
  if (approxWalletAgeDays < 180) return 1;
  return 2; // OG Status
}

/**
 * Phase 1: Time Decay - Activity Score Calculator
 * Returns a multiplier (0.0 - 1.0) based on how recently a user was active.
 *
 * - Last 24 hours:  1.0 (Full score)
 * - 24-72 hours:    0.9 (Slight decay)
 * - 3-7 days:       0.7 (Significant decay)
 *
 * This multiplier is applied to the final score during match calculation.
 */
export function calculateActivityScore(lastActiveAt: number): number {
  const now = Date.now();
  const elapsedMs = now - lastActiveAt;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  if (elapsedHours <= 24) return 1.0;
  if (elapsedHours <= 72) return 0.9;
  return 0.7; // 3-7 days (anything beyond 7 days is filtered by Sleeping Logic in db.ts)
}

/**
 * v2: Intent Layer + Phase 1: Explainability & Reciprocity
 * Weak Link Formula + Badge Bonus (CAP + DECAY) + Asymmetric Role Bonus + Intent Bonus
 *
 * Phase 1 additions:
 * - matchReasons[]: Machine-readable CLEAN_STRING codes for every scoring step
 * - Reciprocity Check: Hard reject if user fails match's minTrustScore filter
 * - Activity Multiplier: Time decay applied to final score
 */
export function calculateMatchScore(
  userAnalysis: WalletAnalysis,
  matchProfile: Omit<MatchProfile, "matchConfidence" | "matchReason" | "socialProof" | "activeBadges" | "confidenceBreakdown" | "intent" | "matchReasons"> & {
    intent: UserIntent;
    matchFilters?: { minTrustScore?: number };
    lastActiveAt?: number;
  },
  socialProof: SocialProof,
  activeBadges: Badge[],
): { confidence: number; reason: string; breakdown: ConfidenceBreakdown; matchReasons: MatchReason[] } {
  // Mentor Logic: Collect structured reasons (POSITIVE + MISSING)
  const matchReasons: MatchReason[] = [];

  // --- RECIPROCITY CHECK (Phase 1) ---
  if (matchProfile.matchFilters?.minTrustScore != null) {
    if (userAnalysis.trustScore < matchProfile.matchFilters.minTrustScore) {
      matchReasons.push({ code: "TRUST_THRESHOLD_MISMATCH", impact: "HIGH", status: "MISSING" });
      return {
        confidence: 0,
        reason: "Trust threshold not met",
        breakdown: { base: 0, context: 0, badgeRaw: 0, badgeCapped: 0, activityMultiplier: 0 },
        matchReasons,
      };
    }
  }

  // 1. BADGE BONUS (CAP + DECAY)
  const systemBadges = activeBadges.filter((b) => b.category === "SYSTEM");
  const socialBadges = activeBadges.filter((b) => b.category === "SOCIAL");

  const systemScore = systemBadges.reduce((sum, badge) => sum + badge.baseWeight, 0);

  const sortedSocialBadges = [...socialBadges].sort((a, b) => b.baseWeight - a.baseWeight);
  const decayFactors = [1, 0.6, 0.3];
  const socialScore = sortedSocialBadges.reduce((sum, badge, index) => {
    const decay = index < decayFactors.length ? decayFactors[index] : 0;
    return sum + badge.baseWeight * decay;
  }, 0);

  const badgeBonus = Math.min(systemScore + socialScore, 25);

  // Explainability: Badge reasons (POSITIVE)
  if (systemScore > 0) matchReasons.push({ code: "BADGE_BONUS_SYSTEM", impact: "MEDIUM", status: "POSITIVE" });
  if (socialScore > 0) matchReasons.push({ code: "BADGE_BONUS_SOCIAL", impact: "MEDIUM", status: "POSITIVE" });
  if (systemBadges.some((b) => b.id === "whale")) matchReasons.push({ code: "BADGE_BONUS_WHALE", impact: "HIGH", status: "POSITIVE" });
  if (systemBadges.some((b) => b.id === "dev")) matchReasons.push({ code: "BADGE_BONUS_DEV", impact: "MEDIUM", status: "POSITIVE" });
  if (socialBadges.some((b) => b.id === "governor")) matchReasons.push({ code: "BADGE_BONUS_GOVERNOR", impact: "HIGH", status: "POSITIVE" });

  // 2. ASYMMETRIC ROLE BONUS
  let roleBonus = 0;
  let roleReason = "";
  let tagReason = "";

  const userIsWhale = userAnalysis.badges.includes("whale") || userAnalysis.solBalance > 10;
  const userIsDeveloper = userAnalysis.tokenDiversity > 10;
  const userRole = userIsWhale ? "Whale" : userIsDeveloper ? "Dev" : "Normal";

  if (userRole === "Dev" && matchProfile.role === "Whale") {
    roleBonus = 20;
    roleReason = "Funding Match (+20%)";
    matchReasons.push({ code: "ROLE_SYNERGY_FUNDING", impact: "HIGH", status: "POSITIVE" });
  } else if (userRole === "Whale" && matchProfile.role === "Dev") {
    roleBonus = 25;
    roleReason = "Product Match (+25%)";
    matchReasons.push({ code: "ROLE_SYNERGY_PRODUCT", impact: "HIGH", status: "POSITIVE" });
  } else if (userRole === "Dev" && matchProfile.role === "Marketing") {
    roleBonus = 20;
    roleReason = "Growth Match (+20%)";
    matchReasons.push({ code: "ROLE_SYNERGY_GROWTH", impact: "HIGH", status: "POSITIVE" });
  } else if (userRole === "Dev" && matchProfile.role === "Dev") {
    roleBonus = 5;
    roleReason = "Peer Match (+5%)";
    matchReasons.push({ code: "ROLE_SYNERGY_PEER", impact: "LOW", status: "POSITIVE" });
  } else if (userIsWhale && matchProfile.role === "Artist") {
    roleBonus = 15;
    roleReason = "Creative Match (+15%)";
    matchReasons.push({ code: "ROLE_SYNERGY_CREATIVE", impact: "MEDIUM", status: "POSITIVE" });
  } else if (userAnalysis.nftCount > 5 && matchProfile.role === "Artist") {
    roleBonus = 15;
    roleReason = "NFT Project Match (+15%)";
    matchReasons.push({ code: "ROLE_SYNERGY_NFT", impact: "MEDIUM", status: "POSITIVE" });
  }

  // Tag Synergy
  const userInterests: string[] = [];
  if (userAnalysis.nftCount > 5) userInterests.push("NFT");
  if (userAnalysis.tokenCount > 10) userInterests.push("DeFi");
  if (userAnalysis.tokenDiversity > 5) userInterests.push("Trading");

  const commonTags = matchProfile.tags.filter((tag) =>
    userInterests.some((interest) =>
      tag.toLowerCase().includes(interest.toLowerCase()) ||
      interest.toLowerCase().includes(tag.toLowerCase()),
    ),
  );

  const hasTagSynergy = commonTags.length > 0;
  if (hasTagSynergy) {
    roleBonus += 10;
    tagReason = ` & Shared ${commonTags[0]} Interest (+10%)`;
    matchReasons.push({ code: "TAG_SYNERGY", impact: "MEDIUM", status: "POSITIVE" });
  }

  // 3. INTENT BONUS
  let intentBonus = 0;
  let intentReason = "";
  const userIntent = userAnalysis.intent;
  const matchIntent = matchProfile.intent;
  let intentMatched = false;

  if (userIntent && matchIntent) {
    if (userIntent === "BUILD_SQUAD" && matchIntent === "JOIN_PROJECT") {
      intentBonus = 20;
      intentReason = "Perfect Fit: Squad Builder meets Project Joiner";
      matchReasons.push({ code: "INTENT_MATCH_PERFECT", impact: "HIGH", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "FIND_FUNDING" && matchIntent === "FIND_FUNDING") {
      intentBonus = 0;
      intentReason = "Neutral: Both seeking funding";
      matchReasons.push({ code: "INTENT_NEUTRAL", impact: "LOW", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "HIRE_TALENT" && matchIntent === "JOIN_PROJECT") {
      intentBonus = 20;
      intentReason = "Perfect Fit: Talent Seeker meets Project Joiner";
      matchReasons.push({ code: "INTENT_MATCH_PERFECT", impact: "HIGH", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "NETWORK" && matchIntent === "NETWORK") {
      intentBonus = 10;
      intentReason = "Safe Match: Both networking";
      matchReasons.push({ code: "INTENT_MATCH_SAFE", impact: "MEDIUM", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "FIND_FUNDING" && matchIntent === "BUILD_SQUAD") {
      intentBonus = 15;
      intentReason = "Capital meets Talent";
      matchReasons.push({ code: "INTENT_MATCH_CAPITAL", impact: "HIGH", status: "POSITIVE" });
      intentMatched = true;
    }
  }

  // Mentor Logic: MISSING signal - Intent mismatch (no bonus, no penalty, but mentor feedback)
  if (userIntent && matchIntent && !intentMatched) {
    matchReasons.push({ code: "INTENT_MISMATCH", impact: "HIGH", status: "MISSING" });
  }

  // ContextBonus = RoleBonus + IntentBonus, Max 20
  const contextBonus = Math.min(roleBonus + intentBonus, 20);

  // 4. BASE SCORE (WEAK LINK FORMULA)
  const minScore = Math.min(userAnalysis.trustScore, matchProfile.trustScore);
  const maxScore = Math.max(userAnalysis.trustScore, matchProfile.trustScore);
  const baseScore = minScore * 0.7 + maxScore * 0.3;
  matchReasons.push({ code: "WEAK_LINK_APPLIED", impact: "LOW", status: "POSITIVE" });

  // 5. ACTIVITY MULTIPLIER (Phase 1: Time Decay)
  let activityMultiplier = 1.0;
  if (matchProfile.lastActiveAt != null) {
    activityMultiplier = calculateActivityScore(matchProfile.lastActiveAt);
    if (activityMultiplier < 1.0) {
      matchReasons.push({ code: "ACTIVITY_DECAY_APPLIED", impact: "MEDIUM", status: "MISSING" });
    }
  }

  // 6. FINAL CALCULATION
  const rawTotal = baseScore + badgeBonus + contextBonus;
  const decayedTotal = rawTotal * activityMultiplier;
  const finalConfidence = Math.min(98, Math.round(decayedTotal));

  // Social Proof reasons
  if (socialProof.communityTrusted) {
    matchReasons.push({ code: "SOCIAL_PROOF_COMMUNITY", impact: "HIGH", status: "POSITIVE" });
  } else if (socialProof.verified) {
    matchReasons.push({ code: "SOCIAL_PROOF_VERIFIED", impact: "MEDIUM", status: "POSITIVE" });
  }

  // Mentor Logic: MISSING signal - No shared social proof
  if (!socialProof.communityTrusted && !socialProof.verified) {
    matchReasons.push({ code: "NO_SOCIAL_PROOF", impact: "MEDIUM", status: "MISSING" });
  }

  // Breakdown for tooltip
  const breakdown: ConfidenceBreakdown = {
    base: Math.round(baseScore),
    context: contextBonus,
    badgeRaw: systemScore + socialScore,
    badgeCapped: badgeBonus,
    activityMultiplier,
  };

  // Human-readable reason (Intent reason takes priority)
  let reason = "";
  if (intentReason) {
    reason = intentReason;
    if (roleReason) {
      reason += ` · ${roleReason}`;
    }
    if (tagReason) {
      reason += tagReason;
    }
  } else if (roleReason) {
    reason = roleReason + (tagReason || "");
  } else if (tagReason) {
    reason = `Trust Score Compatibility${tagReason}`;
  } else {
    reason = `Trust Score Alignment (${Math.round(baseScore)}% base compatibility)`;
  }

  if (socialProof.communityTrusted) {
    reason = `Community Trusted · ${reason}`;
  } else if (socialProof.verified) {
    reason = `Verified · ${reason}`;
  }

  return {
    confidence: finalConfidence,
    reason,
    breakdown,
    matchReasons,
  };
}

// Pool'lar artık kullanılmıyor - Sadece test profilleri kullanılıyor

/**
 * v2: Intent Layer - Match Engine
 * TEST MODE: Hardcoded 2 profil döndürür
 */
export function getMatches(analysis: WalletAnalysis): MatchProfile[] {
  // TEST PROFİLLERİ - Hardcoded
  const testProfiles: Omit<MatchProfile, "matchConfidence" | "matchReason" | "socialProof" | "activeBadges" | "confidenceBreakdown" | "intent">[] = [
    {
      id: "test-1",
      username: "SolanaGod_OG",
      role: "Community",
      trustScore: 98,
      tags: ["DAO", "Governance", "Yield"],
    },
    {
      id: "test-2",
      username: "PassiveWhale",
      role: "Whale",
      trustScore: 92,
      tags: ["HODL", "BTC"],
    },
  ];

  const testSocialProofs: SocialProof[] = [
    { verified: true, communityTrusted: true, endorsements: 50 },
    { verified: true, communityTrusted: false, endorsements: 5 },
  ];

  const testBadges: Badge[][] = [
    // Profil A (Community Leader): community_trusted (+7) + governor (+12) = Raw 19 -> Decay: 7*1 + 12*0.6 = 7 + 7.2 = 14.2
    [
      { id: "community_trusted", label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
      { id: "governor", label: "Governor", category: "SOCIAL", baseWeight: 12, icon: "Crown" },
    ],
    // Profil B (Rich Passive): whale (+6)
    [
      { id: "whale", label: "Whale", category: "SYSTEM", baseWeight: 6, icon: "Waves" },
    ],
  ];

  // v2: Intent Layer - Mock Intent'ler
  const testIntents: UserIntent[] = [
    "BUILD_SQUAD", // SolanaGod_OG
    "FIND_FUNDING", // PassiveWhale
  ];

  // Calculate matchConfidence for each profile
  return testProfiles.map((profile, index) => {
    const socialProof = testSocialProofs[index];
    const activeBadges = testBadges[index];
    const matchIntent = testIntents[index];
    const profileWithIntent = { ...profile, intent: matchIntent };
    const { confidence, reason, breakdown, matchReasons } = calculateMatchScore(analysis, profileWithIntent, socialProof, activeBadges);
    return {
      ...profile,
      matchConfidence: confidence,
      matchReason: reason,
      socialProof,
      activeBadges,
      confidenceBreakdown: breakdown,
      intent: matchIntent,
      matchReasons,
    };
  });
}
