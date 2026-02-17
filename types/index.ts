export type BadgeId = "whale" | "dev" | "og_wallet" | "community_trusted" | "governor";

export type UserIntent = "BUILD_SQUAD" | "FIND_FUNDING" | "HIRE_TALENT" | "JOIN_PROJECT" | "NETWORK";

// Identity Hierarchy & Sorting - CTO Tuning
// VERIFIED (Top) > REACHABLE > GHOST (Default)
export type IdentityState = "VERIFIED" | "REACHABLE" | "GHOST";

export type ScoreBreakdown = {
  balanceScore: number;
  activityScore: number;
  diversityScore: number;
  penalty: number;
  total: number;
  explanation: string;
};

export type AnalyzeWalletResult = {
  address: string;
  solBalance: number;
  tokenCount: number; // Fungible tokens (coins) only
  nftCount: number; // NFTs / Non-fungible assets
  assetCount: number; // Total assets
  activityCount: number;
  transactionCount: number;
  tokenDiversity: number;
  scoreBreakdown: ScoreBreakdown;
};

export type SocialProof = {
  verified: boolean; // Algoritmik doğrulama (Mavi Tik)
  communityTrusted: boolean; // İnsan onayı (Altın Kalkan)
  endorsements: number; // Kaç kişi onaylamış
};

export type BadgeCategory = "SYSTEM" | "SOCIAL";

export type Badge = {
  id: BadgeId;
  label: string;
  category: BadgeCategory;
  baseWeight: number;
  icon: string;
};

export type ConfidenceBreakdown = {
  base: number;
  context: number;
  badgeRaw: number;
  badgeCapped: number;
  activityMultiplier?: number; // Phase 1: Time Decay
};

// Phase 1: Engine Hardening - Machine-readable match reasons
// CLEAN_STRINGS only: no emojis, no sentences
export type MatchReasonCode =
  | "ROLE_SYNERGY_FUNDING"
  | "ROLE_SYNERGY_PRODUCT"
  | "ROLE_SYNERGY_GROWTH"
  | "ROLE_SYNERGY_PEER"
  | "ROLE_SYNERGY_CREATIVE"
  | "ROLE_SYNERGY_NFT"
  | "TAG_SYNERGY"
  | "INTENT_MATCH_PERFECT"
  | "INTENT_MATCH_SAFE"
  | "INTENT_MATCH_CAPITAL"
  | "INTENT_NEUTRAL"
  | "INTENT_MISMATCH"
  | "BADGE_BONUS_SYSTEM"
  | "BADGE_BONUS_SOCIAL"
  | "BADGE_BONUS_WHALE"
  | "BADGE_BONUS_DEV"
  | "BADGE_BONUS_GOVERNOR"
  | "BADGE_BONUS_VERIFIED"
  | "SOCIAL_PROOF_COMMUNITY"
  | "SOCIAL_PROOF_VERIFIED"
  | "NO_SOCIAL_PROOF"
  | "WEAK_LINK_APPLIED"
  | "ACTIVITY_DECAY_APPLIED"
  | "TRUST_THRESHOLD_MISMATCH";

// Mentor Logic: Structured match reason with impact and status
export type MatchReasonImpact = "HIGH" | "MEDIUM" | "LOW";
export type MatchReasonStatus = "POSITIVE" | "MISSING";

export type MatchReason = {
  code: MatchReasonCode;
  impact: MatchReasonImpact;
  status: MatchReasonStatus;
};

export type WalletAnalysis = {
  address: string;
  solBalance: number;
  tokenCount: number;
  nftCount: number;
  assetCount: number;
  score: number;
  scoreLabel: string;
  trustScore: number;
  badges: BadgeId[];
  transactionCount: number;
  tokenDiversity: number;
  scoreBreakdown: ScoreBreakdown;
  // Pump Match - Calculated scores
  systemScore: number; // System rozetlerinin toplamı
  socialScore: number; // Decay uygulanmış sosyal skor
  // v2: Intent Layer
  intent?: UserIntent; // Nullable - Kullanıcı seçmediyse undefined
  // Opt-In Network Architecture
  isRegistered: boolean; // Is this wallet in the network registry?
  // Production Grade: Wallet age in days (from first activity, NOT creation date)
  approxWalletAge?: number; // Days since first detected activity
};

export type MatchProfile = {
  id: string;
  username: string;
  role: "Dev" | "Artist" | "Marketing" | "Whale" | "Community";
  trustScore: number;
  tags: string[];
  matchReason: string;
  avatarUrl?: string;
  matchConfidence: number;
  socialProof: SocialProof;
  activeBadges: Badge[];
  confidenceBreakdown: ConfidenceBreakdown;
  // v2: Intent Layer
  intent: UserIntent;
  // Identity Hierarchy & Sorting
  identityState?: IdentityState;
  // Mentor Logic: Structured match reasons (POSITIVE + MISSING signals)
  matchReasons?: MatchReason[];
};

// Opt-In Network Architecture - User Profile (Registered Users)
export type UserProfile = {
  id: string;
  address: string;
  username: string;
  role: "Dev" | "Artist" | "Marketing" | "Whale" | "Community";
  trustScore: number;
  tags: string[];
  intent: UserIntent;
  socialProof: SocialProof;
  activeBadges: Badge[];
  lastActiveAt: number; // Timestamp
  isOptedIn: boolean; // Must be true to be in registry
  // Security & Stability - CTO Tuning
  isSystemSeed?: boolean; // Mock user'ları ayırmak için
  joinedAt: number; // Timestamp - OG Badge için (Immutable)
  lastMatchSnapshotAt?: number; // Anti-Probing için cache zamanı
  cachedMatches?: MatchProfile[]; // Son hesaplanan eşleşmeleri saklamak için
  // Identity Hierarchy & Sorting
  identityState?: IdentityState;
  // Phase 1: Engine Hardening - Reputation Decay
  reputationDecay?: number; // 0.0 - 1.0 (1.0 = full reputation, 0.0 = fully decayed)
  // Reciprocity Filter
  matchFilters?: {
    minTrustScore?: number; // Hard reject threshold for incoming matches
  };
};

// God Mode Discovery: Search filter parameters
export type SearchFilters = {
  badgeFilters?: string[];   // Badge IDs (AND logic: must have ALL)
  minTrustScore?: number;    // Minimum trust score (default: 70)
  verifiedOnly?: boolean;    // Only VERIFIED identity state
};

// God Mode Discovery: Lightweight agent card for search results
export type NetworkAgent = {
  id: string;
  address: string;
  username: string;
  role: "Dev" | "Artist" | "Marketing" | "Whale" | "Community";
  trustScore: number;
  identityState?: IdentityState;
  activeBadges: Badge[];
  tags: string[];
};

export type AnalyzeWalletResponse = {
  analysis: AnalyzeWalletResult;
  walletAnalysis: WalletAnalysis; // Pump Match - Full analysis sent to client
  matches: MatchProfile[];
};

// ──────────────────────────────────────────────────────────────
// Arena Financial Snapshot Engine
// ──────────────────────────────────────────────────────────────

export type ArenaProjectStatus = "active" | "ghost" | "rugged";

export type ClaimTier = "founder" | "community";

export type SquadProject = {
  id: string;
  name: string;
  mint_address: string;
  claimed_by: string;
  symbol: string;
  status: ArenaProjectStatus;
  claim_tier: ClaimTier;
  is_renounced: boolean;
  update_authority: string | null;
  market_cap: number | null;
  fdv: number | null;
  liquidity_usd: number | null;
  volume_24h: number | null;
  last_valid_mc: number | null;
  last_mc_update: string | null; // ISO timestamp
  created_at: string;
};

export type DexScreenerPair = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd?: string;
  volume?: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
};
