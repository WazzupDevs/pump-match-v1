import "server-only";

import type { Badge, ConfidenceBreakdown, MatchProfile, MatchReason, SocialProof, UserIntent, WalletAnalysis } from "@/types";

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
  } else if (!userIsWhale && !userIsDeveloper && matchProfile.role === "Marketing") {
    // Community role meets Marketing — content/growth synergy
    roleBonus = 12;
    roleReason = "Community Growth Match (+12%)";
    matchReasons.push({ code: "ROLE_SYNERGY_GROWTH", impact: "MEDIUM", status: "POSITIVE" });
  } else if (userIsDeveloper && matchProfile.role === "Community") {
    // Developer meets Community manager — builder + community
    roleBonus = 12;
    roleReason = "Builder Community Match (+12%)";
    matchReasons.push({ code: "ROLE_SYNERGY_PEER", impact: "MEDIUM", status: "POSITIVE" });
  } else if (!userIsWhale && !userIsDeveloper && matchProfile.role === "Whale") {
    // Community/Marketing role meets Whale — sponsorship fit
    roleBonus = 10;
    roleReason = "Sponsorship Match (+10%)";
    matchReasons.push({ code: "ROLE_SYNERGY_FUNDING", impact: "MEDIUM", status: "POSITIVE" });
  } else if (userIsWhale && matchProfile.role === "Marketing") {
    // Whale meets Marketer — capital + distribution
    roleBonus = 18;
    roleReason = "Capital Growth Match (+18%)";
    matchReasons.push({ code: "ROLE_SYNERGY_GROWTH", impact: "HIGH", status: "POSITIVE" });
  } else if (!userIsWhale && !userIsDeveloper && matchProfile.role === "Artist") {
    // Marketing/Community meets Artist — creative collab
    roleBonus = 15;
    roleReason = "Creative Collab Match (+15%)";
    matchReasons.push({ code: "ROLE_SYNERGY_CREATIVE", impact: "MEDIUM", status: "POSITIVE" });
  }

  // Tag Synergy
  const userInterests: string[] = [];
  if (userAnalysis.nftCount > 5) userInterests.push("NFT");
  if (userAnalysis.tokenCount > 10) userInterests.push("DeFi");
  if (userAnalysis.tokenDiversity > 5) userInterests.push("Trading");

  // Tag matching: exact match first, then word-boundary check to avoid
  // false positives like "fi" matching "DeFi" or "Tr" matching "Trading"
  const commonTags = matchProfile.tags.filter((tag) =>
    userInterests.some((interest) => {
      const t = tag.toLowerCase();
      const i = interest.toLowerCase();
      // Exact match (highest confidence)
      if (t === i) return true;
      // Word-boundary match: interest is a whole word within tag, or vice versa
      const tWords = t.split(/[\s_\-]+/);
      const iWords = i.split(/[\s_\-]+/);
      return tWords.some((tw) => iWords.includes(tw));
    }),
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
    } else if (userIntent === "JOIN_PROJECT" && matchIntent === "BUILD_SQUAD") {
      // Symmetric reverse of BUILD_SQUAD ↔ JOIN_PROJECT
      intentBonus = 20;
      intentReason = "Perfect Fit: Project Joiner meets Squad Builder";
      matchReasons.push({ code: "INTENT_MATCH_PERFECT", impact: "HIGH", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "HIRE_TALENT" && matchIntent === "JOIN_PROJECT") {
      intentBonus = 20;
      intentReason = "Perfect Fit: Talent Seeker meets Project Joiner";
      matchReasons.push({ code: "INTENT_MATCH_PERFECT", impact: "HIGH", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "JOIN_PROJECT" && matchIntent === "HIRE_TALENT") {
      // Symmetric reverse of HIRE_TALENT ↔ JOIN_PROJECT
      intentBonus = 20;
      intentReason = "Perfect Fit: Project Joiner meets Talent Seeker";
      matchReasons.push({ code: "INTENT_MATCH_PERFECT", impact: "HIGH", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "BUILD_SQUAD" && matchIntent === "HIRE_TALENT") {
      // Both building teams — compatible goal
      intentBonus = 15;
      intentReason = "Squad Match: Both building teams";
      matchReasons.push({ code: "INTENT_MATCH_PERFECT", impact: "HIGH", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "HIRE_TALENT" && matchIntent === "BUILD_SQUAD") {
      // Symmetric reverse of BUILD_SQUAD ↔ HIRE_TALENT
      intentBonus = 15;
      intentReason = "Squad Match: Both building teams";
      matchReasons.push({ code: "INTENT_MATCH_PERFECT", impact: "HIGH", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "FIND_FUNDING" && matchIntent === "BUILD_SQUAD") {
      intentBonus = 15;
      intentReason = "Capital meets Talent";
      matchReasons.push({ code: "INTENT_MATCH_CAPITAL", impact: "HIGH", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "BUILD_SQUAD" && matchIntent === "FIND_FUNDING") {
      // Symmetric reverse of FIND_FUNDING ↔ BUILD_SQUAD
      intentBonus = 15;
      intentReason = "Capital meets Talent";
      matchReasons.push({ code: "INTENT_MATCH_CAPITAL", impact: "HIGH", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "NETWORK" && matchIntent === "NETWORK") {
      intentBonus = 10;
      intentReason = "Safe Match: Both networking";
      matchReasons.push({ code: "INTENT_MATCH_SAFE", impact: "MEDIUM", status: "POSITIVE" });
      intentMatched = true;
    } else if (userIntent === "FIND_FUNDING" && matchIntent === "FIND_FUNDING") {
      intentBonus = 0;
      intentReason = "Neutral: Both seeking funding";
      matchReasons.push({ code: "INTENT_NEUTRAL", impact: "LOW", status: "POSITIVE" });
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
 * Preview Match Engine — shown to non-registered (guest) users.
 * These are illustrative profiles calculated with the real scoring engine.
 * Registered users get real matches via getNetworkMatches() in analyzeWallet.ts.
 */
export function getMatches(analysis: WalletAnalysis): MatchProfile[] {
  // PREVIEW PROFILES — 4 diverse roles to show the range of potential matches
  const testProfiles: Omit<MatchProfile, "matchConfidence" | "matchReason" | "socialProof" | "activeBadges" | "confidenceBreakdown" | "intent">[] = [
    {
      id: "preview-1",
      username: "SolanaGod_OG",
      role: "Community",
      trustScore: 98,
      tags: ["DAO", "Governance", "Yield"],
    },
    {
      id: "preview-2",
      username: "PassiveWhale",
      role: "Whale",
      trustScore: 92,
      tags: ["HODL", "DeFi"],
    },
    {
      id: "preview-3",
      username: "0xDev_Mage",
      role: "Dev",
      trustScore: 85,
      tags: ["DeFi", "Rust", "NFT"],
    },
    {
      id: "preview-4",
      username: "MemeLord_Rex",
      role: "Artist",
      trustScore: 76,
      tags: ["NFT", "Art", "Meme"],
    },
  ];

  const testSocialProofs: SocialProof[] = [
    { verified: true, communityTrusted: true, endorsements: 50 },
    { verified: true, communityTrusted: false, endorsements: 5 },
    { verified: false, communityTrusted: false, endorsements: 0 },
    { verified: false, communityTrusted: true, endorsements: 12 },
  ];

  const testBadges: Badge[][] = [
    // Profile A (Community Leader): community_trusted (+7)
    [
      { id: "community_trusted", label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
    ],
    // Profile B (Whale): whale (+6)
    [
      { id: "whale", label: "Whale", category: "SYSTEM", baseWeight: 6, icon: "Waves" },
    ],
    // Profile C (OG Dev): dev (+5) + og_wallet (+4)
    [
      { id: "dev", label: "Dev", category: "SYSTEM", baseWeight: 5, icon: "Code" },
      { id: "og_wallet", label: "OG Wallet", category: "SYSTEM", baseWeight: 4, icon: "Clock" },
    ],
    // Profile D (Artist): community_trusted (+7)
    [
      { id: "community_trusted", label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
    ],
  ];

  // Preview intents — represent realistic distribution
  const testIntents: UserIntent[] = [
    "BUILD_SQUAD",   // SolanaGod_OG — wants to build
    "FIND_FUNDING",  // PassiveWhale — capital ready
    "JOIN_PROJECT",  // 0xDev_Mage — looking for a project
    "NETWORK",       // MemeLord_Rex — exploring
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
