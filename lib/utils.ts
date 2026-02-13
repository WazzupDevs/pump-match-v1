import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { MatchReason, MatchReasonCode, MatchReasonStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ──────────────────────────────────────────────────────────────
// Mentor Logic: Translator V2
// Maps machine-readable MatchReason codes to human-readable
// labels, icons, and colors for the UI layer.
// ──────────────────────────────────────────────────────────────

type ReasonConfig = {
  label: string;
  icon: string; // Lucide icon name
  colorClass: string; // Tailwind text color
  tip?: string; // Mentor improvement tip (for MISSING reasons)
};

// POSITIVE labels: describe what IS contributing to the score
// MISSING labels: describe what COULD improve the score (mentor language)
const REASON_LABELS: Record<MatchReasonCode, { positive: string; missing: string }> = {
  ROLE_SYNERGY_FUNDING: { positive: "Funding synergy detected", missing: "No funding alignment" },
  ROLE_SYNERGY_PRODUCT: { positive: "Product synergy detected", missing: "No product alignment" },
  ROLE_SYNERGY_GROWTH: { positive: "Growth synergy detected", missing: "No growth alignment" },
  ROLE_SYNERGY_PEER: { positive: "Peer collaboration match", missing: "Low peer synergy" },
  ROLE_SYNERGY_CREATIVE: { positive: "Creative synergy detected", missing: "No creative alignment" },
  ROLE_SYNERGY_NFT: { positive: "NFT project synergy", missing: "No NFT alignment" },
  TAG_SYNERGY: { positive: "Shared interests found", missing: "No shared interests" },
  INTENT_MATCH_PERFECT: { positive: "Goals perfectly aligned", missing: "Goals not aligned" },
  INTENT_MATCH_SAFE: { positive: "Compatible networking goals", missing: "Networking goals differ" },
  INTENT_MATCH_CAPITAL: { positive: "Capital meets talent", missing: "Capital-talent gap" },
  INTENT_NEUTRAL: { positive: "Neutral intent overlap", missing: "Intent overlap unclear" },
  INTENT_MISMATCH: { positive: "Intent aligned", missing: "Goals not aligned" },
  BADGE_BONUS_SYSTEM: { positive: "System badges active", missing: "No system badges" },
  BADGE_BONUS_SOCIAL: { positive: "Social badges active", missing: "No social badges" },
  BADGE_BONUS_WHALE: { positive: "Whale badge boost", missing: "No whale status" },
  BADGE_BONUS_DEV: { positive: "Developer badge boost", missing: "No dev badge" },
  BADGE_BONUS_GOVERNOR: { positive: "Governor badge boost", missing: "No governance role" },
  BADGE_BONUS_VERIFIED: { positive: "Verified identity boost", missing: "Identity not verified" },
  SOCIAL_PROOF_COMMUNITY: { positive: "Community trusted", missing: "No community trust" },
  SOCIAL_PROOF_VERIFIED: { positive: "Identity verified", missing: "Not verified" },
  NO_SOCIAL_PROOF: { positive: "Social proof present", missing: "No shared communities found" },
  WEAK_LINK_APPLIED: { positive: "Base trust calculated", missing: "Trust gap detected" },
  ACTIVITY_DECAY_APPLIED: { positive: "Recently active", missing: "Activity declining" },
  TRUST_THRESHOLD_MISMATCH: { positive: "Trust threshold met", missing: "Trust threshold not met" },
};

const REASON_ICONS: Record<MatchReasonCode, string> = {
  ROLE_SYNERGY_FUNDING: "DollarSign",
  ROLE_SYNERGY_PRODUCT: "Rocket",
  ROLE_SYNERGY_GROWTH: "TrendingUp",
  ROLE_SYNERGY_PEER: "Users",
  ROLE_SYNERGY_CREATIVE: "Palette",
  ROLE_SYNERGY_NFT: "Image",
  TAG_SYNERGY: "Tags",
  INTENT_MATCH_PERFECT: "Target",
  INTENT_MATCH_SAFE: "Handshake",
  INTENT_MATCH_CAPITAL: "Gem",
  INTENT_NEUTRAL: "Scale",
  INTENT_MISMATCH: "AlertTriangle",
  BADGE_BONUS_SYSTEM: "Shield",
  BADGE_BONUS_SOCIAL: "Heart",
  BADGE_BONUS_WHALE: "Waves",
  BADGE_BONUS_DEV: "Code",
  BADGE_BONUS_GOVERNOR: "Crown",
  BADGE_BONUS_VERIFIED: "BadgeCheck",
  SOCIAL_PROOF_COMMUNITY: "ShieldCheck",
  SOCIAL_PROOF_VERIFIED: "BadgeCheck",
  NO_SOCIAL_PROOF: "UserX",
  WEAK_LINK_APPLIED: "Link",
  ACTIVITY_DECAY_APPLIED: "Clock",
  TRUST_THRESHOLD_MISMATCH: "ShieldOff",
};

// Mentor tips: actionable advice for MISSING reasons
const MENTOR_TIPS: Partial<Record<MatchReasonCode, string>> = {
  INTENT_MISMATCH: "To improve this match, align your goals or look for users with compatible intents.",
  NO_SOCIAL_PROOF: "Get verified or earn community trust to unlock higher match scores.",
  ACTIVITY_DECAY_APPLIED: "Stay active on-chain to maintain full match potential.",
  TRUST_THRESHOLD_MISMATCH: "Increase your trust score to match with this user's requirements.",
  BADGE_BONUS_VERIFIED: "Verify your identity to boost your visibility in match results.",
};

/**
 * Mentor Logic: Translate a MatchReason into a UI-ready config.
 *
 * Color palette:
 * - POSITIVE: text-emerald-400 (Neon Green)
 * - MISSING:  text-muted-foreground/50 (Ghostly Gray)
 */
export function getReasonConfig(reason: MatchReason): ReasonConfig {
  const labels = REASON_LABELS[reason.code];
  const label = reason.status === "POSITIVE" ? labels.positive : labels.missing;
  const icon = REASON_ICONS[reason.code];
  const colorClass = reason.status === "POSITIVE" ? "text-emerald-400" : "text-muted-foreground/50";
  const tip = reason.status === "MISSING" ? MENTOR_TIPS[reason.code] : undefined;

  return { label, icon, colorClass, tip };
}

/**
 * Sort match reasons for display priority:
 * HIGH POSITIVE > HIGH MISSING > MEDIUM POSITIVE > MEDIUM MISSING > LOW POSITIVE > LOW MISSING
 */
const IMPACT_ORDER: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const STATUS_ORDER: Record<MatchReasonStatus, number> = { POSITIVE: 1, MISSING: 0 };

export function sortMatchReasons(reasons: MatchReason[]): MatchReason[] {
  return [...reasons].sort((a, b) => {
    const impactDiff = (IMPACT_ORDER[b.impact] ?? 0) - (IMPACT_ORDER[a.impact] ?? 0);
    if (impactDiff !== 0) return impactDiff;
    return (STATUS_ORDER[b.status] ?? 0) - (STATUS_ORDER[a.status] ?? 0);
  });
}

/**
 * Generate a mentor improvement tip based on MISSING reasons.
 * Returns a single actionable sentence for the tooltip.
 */
export function getMentorTip(reasons: MatchReason[]): string | null {
  const missingReasons = reasons.filter((r) => r.status === "MISSING");
  if (missingReasons.length === 0) return null;

  // Find the highest-impact MISSING reason with a tip
  const sorted = sortMatchReasons(missingReasons);
  for (const reason of sorted) {
    const tip = MENTOR_TIPS[reason.code];
    if (tip) return tip;
  }

  return "Improve your on-chain activity and verify your identity for better matches.";
}
