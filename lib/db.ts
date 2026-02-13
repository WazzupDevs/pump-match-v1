import "server-only";

import type { Badge, IdentityState, MatchProfile, NetworkAgent, SearchFilters, SocialProof, UserIntent, UserProfile } from "@/types";

// ──────────────────────────────────────────────────────────────
// Phase 2: Rate Limiter with Triple-Layer Identifier & GC
// ──────────────────────────────────────────────────────────────

type RateLimitEntry = {
  count: number;
  resetAt: number; // Timestamp when this window expires
};

// Persist across hot-reloads in dev (Next.js module re-evaluation)
const globalForRateLimit = globalThis as unknown as {
  rateLimits?: Map<string, RateLimitEntry>;
};

if (!globalForRateLimit.rateLimits) {
  globalForRateLimit.rateLimits = new Map<string, RateLimitEntry>();
}

const rateLimits = globalForRateLimit.rateLimits;

/**
 * FNV-1a hash (32-bit) - Fast, non-cryptographic string hash.
 * Used to fingerprint User-Agent strings into a compact key component.
 */
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  // Convert to unsigned 32-bit hex
  return (hash >>> 0).toString(16);
}

/**
 * Garbage Collection for rateLimits Map.
 * Sweeps expired entries when the map exceeds MAX_ENTRIES.
 * Called on every checkRateLimit invocation for self-cleaning behavior.
 */
const RATE_LIMIT_MAX_ENTRIES = 1000;

function gcRateLimits(): void {
  if (rateLimits.size <= RATE_LIMIT_MAX_ENTRIES) return;

  const now = Date.now();
  let swept = 0;
  for (const [key, entry] of rateLimits) {
    if (entry.resetAt < now) {
      rateLimits.delete(key);
      swept++;
    }
  }
  // eslint-disable-next-line no-console
  if (swept > 0) console.log(`[RateLimit GC] Swept ${swept} expired entries. Map size: ${rateLimits.size}`);
}

/**
 * Phase 2: Triple-Layer Rate Limiter
 *
 * Identifier key: `${wallet}:${ip}:${fnv1a(userAgent)}`
 * This prevents a single bot from spamming with different wallets
 * (IP+UA locked) and prevents fingerprint spoofing (wallet+IP locked).
 *
 * @param wallet  - Wallet address
 * @param ip      - Client IP address (from headers)
 * @param userAgent - Raw User-Agent string (will be hashed)
 * @param maxRequests - Max requests per window (default: 10)
 * @param windowMs - Window duration in ms (default: 60s)
 * @returns { allowed: boolean; remaining: number; resetAt: number }
 */
export function checkRateLimit(
  wallet: string,
  ip: string,
  userAgent: string,
  maxRequests: number = 10,
  windowMs: number = 60_000,
): { allowed: boolean; remaining: number; resetAt: number } {
  // Phase 2: GC sweep on every call (O(n) only when size > 1000)
  gcRateLimits();

  const uaHash = fnv1aHash(userAgent || "unknown");
  const identifier = `${wallet}:${ip}:${uaHash}`;
  const now = Date.now();

  const existing = rateLimits.get(identifier);

  // Window expired or first request -- create fresh entry
  if (!existing || existing.resetAt < now) {
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimits.set(identifier, entry);
    return { allowed: true, remaining: maxRequests - 1, resetAt: entry.resetAt };
  }

  // Within window -- increment
  existing.count++;

  if (existing.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    resetAt: existing.resetAt,
  };
}

// ──────────────────────────────────────────────────────────────
// Mock In-Memory Database - Active Wallet Registry
// ──────────────────────────────────────────────────────────────
const mockRegistry = new Map<string, UserProfile>();

// Seed with 10 high-quality mock profiles
function seedMockRegistry() {
  const seedProfiles: Omit<UserProfile, "id" | "address" | "lastActiveAt" | "isOptedIn" | "isSystemSeed" | "joinedAt" | "reputationDecay">[] = [
    {
      username: "SolanaWhale_OG",
      role: "Whale",
      trustScore: 95,
      tags: ["Liquidity", "DeFi", "Trading"],
      intent: "FIND_FUNDING",
      socialProof: { verified: true, communityTrusted: true, endorsements: 25 },
      activeBadges: [
        { id: "whale", label: "Whale", category: "SYSTEM", baseWeight: 6, icon: "Waves" },
        { id: "community_trusted", label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
        { id: "governor", label: "Governor", category: "SOCIAL", baseWeight: 12, icon: "Crown" },
      ],
      // Phase 1: Reciprocity - Whale requires minimum trust score to match
      matchFilters: { minTrustScore: 60 },
    },
    {
      username: "RustMaster",
      role: "Dev",
      trustScore: 92,
      tags: ["Rust", "Solana", "Security", "Smart Contracts"],
      intent: "BUILD_SQUAD",
      socialProof: { verified: true, communityTrusted: true, endorsements: 18 },
      activeBadges: [
        { id: "dev", label: "Dev", category: "SYSTEM", baseWeight: 5, icon: "Code" },
        { id: "community_trusted", label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
      ],
    },
    {
      username: "NFTArtist",
      role: "Artist",
      trustScore: 88,
      tags: ["NFT", "Digital Art", "3D", "Gaming"],
      intent: "JOIN_PROJECT",
      socialProof: { verified: true, communityTrusted: true, endorsements: 15 },
      activeBadges: [
        { id: "community_trusted", label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
      ],
    },
    {
      username: "GrowthHacker",
      role: "Marketing",
      trustScore: 85,
      tags: ["Growth", "Community", "Memecoin", "Social Media"],
      intent: "NETWORK",
      socialProof: { verified: true, communityTrusted: false, endorsements: 8 },
      activeBadges: [
        { id: "dev", label: "Dev", category: "SYSTEM", baseWeight: 5, icon: "Code" },
      ],
    },
    {
      username: "LiquidityKing",
      role: "Whale",
      trustScore: 90,
      tags: ["Liquidity", "Investment", "DeFi"],
      intent: "FIND_FUNDING",
      socialProof: { verified: true, communityTrusted: true, endorsements: 20 },
      activeBadges: [
        { id: "whale", label: "Whale", category: "SYSTEM", baseWeight: 6, icon: "Waves" },
        { id: "og_wallet", label: "OG Wallet", category: "SYSTEM", baseWeight: 4, icon: "Clock" },
      ],
      // Phase 1: Reciprocity - Whale requires minimum trust score
      matchFilters: { minTrustScore: 50 },
    },
    {
      username: "SolanaBuilder",
      role: "Dev",
      trustScore: 87,
      tags: ["Web3", "Full Stack", "Solana", "TypeScript"],
      intent: "HIRE_TALENT",
      socialProof: { verified: true, communityTrusted: true, endorsements: 12 },
      activeBadges: [
        { id: "dev", label: "Dev", category: "SYSTEM", baseWeight: 5, icon: "Code" },
        { id: "community_trusted", label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
      ],
    },
    {
      username: "CommunityLeader",
      role: "Community",
      trustScore: 89,
      tags: ["Community", "Moderation", "Engagement", "DAO"],
      intent: "NETWORK",
      socialProof: { verified: true, communityTrusted: true, endorsements: 22 },
      activeBadges: [
        { id: "community_trusted", label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
        { id: "governor", label: "Governor", category: "SOCIAL", baseWeight: 12, icon: "Crown" },
      ],
    },
    {
      username: "CryptoInfluencer",
      role: "Marketing",
      trustScore: 82,
      tags: ["Influencer", "Memecoin", "Community", "Social Media"],
      intent: "BUILD_SQUAD",
      socialProof: { verified: true, communityTrusted: true, endorsements: 14 },
      activeBadges: [
        { id: "community_trusted", label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
      ],
    },
    {
      username: "DeFiWizard",
      role: "Dev",
      trustScore: 91,
      tags: ["DeFi", "Smart Contracts", "Yield", "Liquidity"],
      intent: "JOIN_PROJECT",
      socialProof: { verified: true, communityTrusted: true, endorsements: 19 },
      activeBadges: [
        { id: "dev", label: "Dev", category: "SYSTEM", baseWeight: 5, icon: "Code" },
        { id: "community_trusted", label: "Community Trusted", category: "SOCIAL", baseWeight: 7, icon: "ShieldCheck" },
        { id: "governor", label: "Governor", category: "SOCIAL", baseWeight: 12, icon: "Crown" },
      ],
    },
    {
      username: "PixelMaster",
      role: "Artist",
      trustScore: 84,
      tags: ["Pixel Art", "Gaming", "NFT", "Retro"],
      intent: "JOIN_PROJECT",
      socialProof: { verified: true, communityTrusted: false, endorsements: 6 },
      activeBadges: [
        { id: "dev", label: "Dev", category: "SYSTEM", baseWeight: 5, icon: "Code" },
      ],
    },
  ];

  const baseJoinTime = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago for OG status
  
  seedProfiles.forEach((profile, index) => {
    const address = `seed_${index}_${profile.username.toLowerCase().replace(/\s+/g, "_")}`;
    // Identity Hierarchy: Some seed users are VERIFIED, some REACHABLE, some GHOST
    const identityStates: IdentityState[] = ["VERIFIED", "VERIFIED", "REACHABLE", "REACHABLE", "GHOST"];
    const identityState: IdentityState = identityStates[index % identityStates.length] ?? "GHOST";
    
    // Phase 1: reputationDecay based on activity recency
    // More recent users have higher reputation (closer to 1.0)
    const hoursAgo = (index * 86400000) / (1000 * 60 * 60);
    const reputationDecay = hoursAgo <= 24 ? 1.0 : hoursAgo <= 72 ? 0.9 : 0.7;

    const userProfile: UserProfile = {
      id: `user_${index + 1}`,
      address,
      ...profile,
      lastActiveAt: Date.now() - index * 86400000, // Staggered timestamps
      isOptedIn: true, // All seed profiles are opted in
      isSystemSeed: true, // Security & Stability - Mark as system seed
      joinedAt: baseJoinTime - index * 86400000, // Staggered join dates for OG Badge
      identityState, // Identity Hierarchy & Sorting
      reputationDecay, // Phase 1: Engine Hardening
    };
    mockRegistry.set(address, userProfile);
  });
}

// Initialize seed data on module load
seedMockRegistry();

/**
 * Upsert User - Only works if isOptedIn is true
 * This is the ONLY write operation allowed
 * Security & Stability: joinedAt is IMMUTABLE (preserved on updates)
 */
export function upsertUser(profile: UserProfile): boolean {
  if (!profile.isOptedIn) {
    // eslint-disable-next-line no-console
    console.warn(`[DB] Attempted to save user ${profile.address} without opt-in. Rejected.`);
    return false;
  }

  // Check if user already exists to preserve immutable joinedAt
  const existingUser = mockRegistry.get(profile.address);
  const preservedJoinedAt = existingUser?.joinedAt ?? profile.joinedAt;

  const updatedProfile: UserProfile = {
    ...profile,
    lastActiveAt: Date.now(),
    isOptedIn: true, // Ensure it's set
    joinedAt: preservedJoinedAt, // Security & Stability - Immutable Join Date
  };

  mockRegistry.set(profile.address, updatedProfile);
  // eslint-disable-next-line no-console
  console.log(`[DB] User ${profile.address} saved to registry. Total users: ${mockRegistry.size}`);
  return true;
}

/**
 * Find Matches - Must ONLY return users from mockRegistry
 * Only accessible to registered users
 * Phase 1: Sleeping Logic - Only return users active within last 7 days
 * CRITICAL: Never modify IdentityState or isOptedIn of sleeping users
 */
const SLEEPING_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function findMatches(userAddress: string, limit: number = 10): UserProfile[] {
  // Check if user is registered
  const user = mockRegistry.get(userAddress);
  if (!user || !user.isOptedIn) {
    return []; // Not registered, return empty
  }

  const now = Date.now();

  // Return all other registered users (excluding self)
  // Phase 1: Sleeping Logic - Filter out users inactive for 7+ days
  // These users remain in the DB with all their state intact; they are
  // simply excluded from the current query ("Sleeping Mode")
  const matches = Array.from(mockRegistry.values())
    .filter((profile) => {
      if (profile.address === userAddress) return false; // Exclude self
      if (!profile.isOptedIn) return false; // Must be opted in
      // Sleeping check: only include users active within the last 7 days
      if (now - profile.lastActiveAt > SLEEPING_THRESHOLD_MS) return false;
      return true;
    })
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt) // Most recent first
    .slice(0, limit);

  return matches;
}

/**
 * Check if user is registered
 */
export function isUserRegistered(address: string): boolean {
  const user = mockRegistry.get(address);
  return user?.isOptedIn === true;
}

/**
 * Get user profile if registered
 */
export function getUserProfile(address: string): UserProfile | null {
  const user = mockRegistry.get(address);
  return user?.isOptedIn ? user : null;
}

// ──────────────────────────────────────────────────────────────
// God Mode Discovery: Network Search (READ-ONLY, No Side Effects)
// ──────────────────────────────────────────────────────────────

/**
 * Search the network registry with AND-based filtering.
 * PURE READ operation - NEVER modifies any data.
 *
 * AND Logic: If multiple badge filters are selected, the user must have ALL of them.
 * Special badge: "high_roller" = trustScore >= 90 (virtual badge, not stored).
 *
 * @returns Lightweight NetworkAgent[] sorted by trustScore (highest first).
 */
export function searchNetwork(filters: SearchFilters, limit: number = 20): NetworkAgent[] {
  const { badgeFilters = [], minTrustScore = 0, verifiedOnly = false } = filters;

  const results = Array.from(mockRegistry.values())
    .filter((profile) => {
      // Must be opted in
      if (!profile.isOptedIn) return false;

      // Trust score floor
      if (profile.trustScore < minTrustScore) return false;

      // Verified-only filter
      if (verifiedOnly && profile.identityState !== "VERIFIED") return false;

      // AND logic: must have ALL selected badges
      if (badgeFilters.length > 0) {
        const userBadgeIds = new Set(profile.activeBadges.map((b) => b.id as string));
        const hasAll = badgeFilters.every((filter) => {
          // Virtual badge: "high_roller" = trustScore >= 90
          if (filter === "high_roller") return profile.trustScore >= 90;
          // Virtual badge: "early_adopter" = has og_wallet badge
          if (filter === "early_adopter") return userBadgeIds.has("og_wallet");
          // Direct badge match
          return userBadgeIds.has(filter);
        });
        if (!hasAll) return false;
      }

      return true;
    })
    .sort((a, b) => b.trustScore - a.trustScore) // Highest trust first
    .slice(0, limit);

  // Map to lightweight NetworkAgent (strip sensitive/heavy fields)
  return results.map((profile) => ({
    id: profile.id,
    address: profile.address,
    username: profile.username,
    role: profile.role,
    trustScore: profile.trustScore,
    identityState: profile.identityState,
    activeBadges: profile.activeBadges,
    tags: profile.tags,
  }));
}

/**
 * Update match snapshot cache for a user
 * Security & Stability - Rate Limit/Snapshot Logic
 */
export function updateMatchSnapshot(
  address: string,
  cachedMatches: MatchProfile[],
): boolean {
  const user = mockRegistry.get(address);
  if (!user || !user.isOptedIn) {
    return false;
  }

  const updatedProfile: UserProfile = {
    ...user,
    cachedMatches,
    lastMatchSnapshotAt: Date.now(),
  };

  mockRegistry.set(address, updatedProfile);
  return true;
}
