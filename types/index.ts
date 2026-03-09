import type {
  ModelVersion,
  ScoreWindow,
  VisibilityMode,
  ConfidenceTier,
  BehavioralFeatures,
  StyleScores,
  QualityScores,
  RiskScores,
  IntelligenceConfidence,
  IntelligenceSummary,
  ScoreSnapshot,
  IntelligenceReport,
  WalletReceipt,
  ArenaBridgeFields,
} from "./intelligence";

export type {
  ModelVersion,
  ScoreWindow,
  VisibilityMode,
  ConfidenceTier,
  BehavioralFeatures,
  StyleScores,
  QualityScores,
  RiskScores,
  IntelligenceConfidence,
  IntelligenceSummary,
  ScoreSnapshot,
  IntelligenceReport,
  WalletReceipt,
  ArenaBridgeFields,
};

export type BadgeId =
  | "whale"
  | "dev"
  | "og_wallet"
  | "community_trusted"
  | "mega_jeet"
  | "diamond_hands"
  | "rug_magnet";

// Tek yerde tanımlanan Role tipi — MatchProfile, UserProfile ve NetworkAgent tarafından paylaşılır
export type Role = "Dev" | "Artist" | "Marketing" | "Whale" | "Community";

export type UserIntent = "BUILD_SQUAD" | "FIND_FUNDING" | "HIRE_TALENT" | "JOIN_PROJECT" | "NETWORK";

// Identity Hierarchy & Sorting - CTO Tuning
// VERIFIED (Top) > REACHABLE > GHOST (Default)
export type IdentityState = "VERIFIED" | "REACHABLE" | "GHOST";

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export type PumpStats = {
  pumpMintsTouched: number;
  closedPositions: number;
  medianHoldTimeSeconds: number;
  jeetScore: number;
  rugMagnetScore: number;
  confidence?: ConfidenceLevel;
};

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

export type SocialLinks = {
  twitter?: string;
  telegram?: string;
};

// Intelligence Core V2: wallet-level intelligence snapshot (coordination-agnostic).
// Coordination metadata (like intent) lives on UserProfile, not here.
export type WalletAnalysis = {
  address: string;
  solBalance: number;
  tokenCount: number;
  nftCount: number;
  assetCount: number;
  /** @deprecated Legacy scalar score; v2 should prefer intelligenceReport.snapshot. */
  score: number;
  /** @deprecated Legacy label; v2 should prefer intelligenceReport.snapshot.summary.scoreLabel. */
  scoreLabel: string;
  /** @deprecated Legacy trust score; v2 should prefer intelligenceReport.legacyTrustScore. */
  trustScore: number;
  badges: BadgeId[];
  transactionCount: number;
  tokenDiversity: number;
  scoreBreakdown: ScoreBreakdown;
  // Pump Match - Calculated scores
  systemScore: number; // System rozetlerinin toplamı
  socialScore: number; // Decay uygulanmış sosyal skor
  /**
   * @deprecated Coordination-layer intent. Canonical location is UserProfile.intent,
   * not the wallet intelligence surface. Kept for backward compatibility only.
   */
  intent?: UserIntent;
  // Opt-In Network Architecture
  isRegistered: boolean; // Is this wallet in the network registry?
  // Production Grade: Wallet age in days (from first activity, NOT creation date)
  approxWalletAge?: number; // Days since first detected activity
  pumpStats: PumpStats | null;
  // Helius Wallet Balances API — total USD value of all token holdings (hourly pricing, beta)
  portfolioValueUsd?: number; // undefined if API unavailable or failed
  // V8 Analysis Engine: behavioral metrics derived from on-chain data
  behavioral?: BehavioralMetrics;
  // V8 Analysis Engine: market data from DexScreener (optional, may be absent in cached responses)
  marketData?: { topTokens: MarketSnapshot[] };
  // Intelligence Core: optional multi-axis scores and summary
  styleScores?: StyleScores;
  qualityScores?: QualityScores;
  riskScores?: RiskScores;
  intelligenceConfidence?: IntelligenceConfidence;
  intelligenceSummary?: IntelligenceSummary;
  // Intelligence Core V2: canonical report snapshot (Phase 2+)
  intelligenceReport?: IntelligenceReport;
};

// Re-export MarketSnapshot from types for convenience (canonical definition in lib/market-data.ts)
export type MarketSnapshot = {
  mint: string;
  priceUsd?: number;
  liquidityUsd?: number;
  fdvUsd?: number;
  updatedAt: number;
};

// V8 Analysis Engine: on-chain behavioral profile
export type BehavioralMetrics = {
  jeetIndex: number;           // 0-100: higher = more jeet-like behavior
  rugExposureIndex: number;    // 0-100: higher = more rug exposure
  avgHoldingTimeSec?: number;  // median holding time in seconds (proxy from pumpStats)
  tradeFreqScore?: number;     // 0-100: trade frequency relative to wallet age
  /**
   * Canonical V2 name: describes which evidence sources contributed
   * to this behavioral profile (e.g. "Helius Enhanced TX + Pump Simulation").
   */
  evidenceSources: string;
  /**
   * @deprecated Use evidenceSources instead.
   * Kept temporarily as backward-compat alias for existing callers.
   */
  confidenceLabel?: string;
};

export type MatchProfile = {
  id: string;
  username: string;
  role: Role;
  trustScore: number;
  tags: string[];
  matchReason: string;
  avatarUrl?: string;
  matchConfidence: number;
  socialProof: SocialProof;
  activeBadges: Badge[];
  confidenceBreakdown: ConfidenceBreakdown;
  // v2: Intent Layer — optional, kullanıcı seçmediyse undefined olabilir
  intent?: UserIntent;
  // Identity Hierarchy & Sorting
  identityState?: IdentityState;
  // Mentor Logic: Structured match reasons (POSITIVE + MISSING signals)
  matchReasons?: MatchReason[];
  // Social contact handles (from DB, shown on Connect)
  socialLinks?: SocialLinks;
  // Endorsement system: community trust signal
  address?: string;          // Wallet address (for endorsement action)
  endorsementCount?: number; // Real-time count from endorsements table
  isEndorsedByMe?: boolean;  // Whether the current user has already endorsed this profile
};

// Opt-In Network Architecture - User Profile (Registered Users)
export type UserProfile = {
  id: string;
  address: string;
  username: string;
  role: Role;
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
  // Social contact handles (optional, user-provided)
  socialLinks?: SocialLinks;
};

// God Mode Discovery: Search filter parameters
export type SearchFilters = {
  badgeFilters?: string[];   // Badge IDs (AND logic: must have ALL)
  minTrustScore?: number;    // Minimum trust score (default: 70)
  verifiedOnly?: boolean;    // Only VERIFIED identity state
  username?: string;         // Case-insensitive partial match on username
  limit?: number;            // Max results (default: 50, max: 100)
  offset?: number;           // Pagination offset (default: 0)
};

// God Mode Discovery: Lightweight agent card for search results
export type NetworkAgent = {
  id: string;
  address: string;
  username: string;
  role: Role;
  trustScore: number;
  identityState?: IdentityState;
  activeBadges: Badge[];
  tags: string[];
};

export type AnalyzeWalletResponse = {
  analysis: AnalyzeWalletResult;
  walletAnalysis: WalletAnalysis; // Pump Match - Full analysis sent to client
  /**
   * @deprecated Preview matches are a legacy coordination layer concern and
   * are not part of the canonical Intelligence Core v2 response. This field
   * is optional and may be omitted when matches are not requested.
   */
  matches?: MatchProfile[];
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
  created_by_wallet: string;
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

export type SquadMemberStatus =
  | "active"
  | "pending_invite"
  | "pending_application"
  | "rejected"
  | "revoked"
  | "kicked"
  | "left";

export type SquadMember = {
  id: string;
  projectId: string;
  walletAddress: string;   // masked in UI (first4...last4)
  displayAddress: string;  // pre-masked version for display
  role?: Role;
  status: SquadMemberStatus;
  joinedAt: string;        // ISO timestamp
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
