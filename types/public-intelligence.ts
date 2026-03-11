import type {
    ConfidenceTier,
    VisibilityMode,
  } from "./intelligence";
  
  export type PublicBehavioralDTO = {
    jeetIndex: number;
    rugExposureIndex: number;
    avgHoldingTimeSec: number;
    tradeFreqScore: number;
    evidenceSources: string;
    /** @deprecated transitional alias only */
    confidenceLabel?: string;
  } | null;
  
  export type PublicPumpStatsDTO = {
    pumpMintsTouched: number;
    closedPositions: number;
    medianHoldTimeSeconds: number;
    jeetScore: number;
    rugMagnetScore: number;
    confidence: string;
  } | null;
  
  export type PublicStyleScoresDTO = {
    sniper: number;
    scalper: number;
    swing: number;
    conviction: number;
  } | null;
  
  export type PublicQualityScoresDTO = {
    consistency: number;
    pnlQuality: number;
    longevity: number;
    overall: number;
  } | null;
  
  export type PublicRiskScoresDTO = {
    churn: number;
    rugExposure: number;
    suspiciousness: number;
  } | null;
  
  export type PublicIntelligenceConfidenceDTO = {
    overall: number;
    tier: ConfidenceTier;
    sampleSize: number;
  } | null;
  
  export type PublicIntelligenceSummaryDTO = {
    primaryStyle: string;
    scoreLabel: string;
    summary: string;
  } | null;

  /**
   * Staged fallback public profile DTO. Canonical public share is receipt-based.
   * Primary: intelligenceSummary, intelligenceConfidence, styleScores, qualityScores, riskScores.
   * Compatibility (secondary): trustScore, top-level scoreLabel, badges.
   */
  export type PublicProfileDTO = {
    address: string;
    visibilityMode: VisibilityMode;
    /** @deprecated Compatibility only. Prefer intelligenceSummary / intelligenceConfidence for canonical view. */
    trustScore: number;
    /** Compatibility mirror of intelligenceSummary.scoreLabel; canonical is intelligenceSummary.scoreLabel. */
    scoreLabel: string;
    /** Compatibility; not part of canonical intelligence surface. */
    badges: string[];

    solBalance?: number | null;
    tokenCount?: number | null;
    nftCount?: number | null;
    assetCount?: number | null;
    transactionCount?: number | null;
    tokenDiversity?: number | null;
    approxWalletAge?: number | null;
    portfolioValueUsd?: number | null;

    behavioral?: PublicBehavioralDTO;
    pumpStats?: PublicPumpStatsDTO;
    styleScores: PublicStyleScoresDTO;
    qualityScores: PublicQualityScoresDTO;
    riskScores: PublicRiskScoresDTO;

    intelligenceConfidence: PublicIntelligenceConfidenceDTO;
    intelligenceSummary: PublicIntelligenceSummaryDTO;

    latestSnapshotId?: string | null;
    receiptShareId?: string | null;
  };
  
  export type PublicReceiptSurfaceDTO = {
    shareId: string;
    walletAddress: string;
    visibility: Extract<VisibilityMode, "PUBLIC" | "VERIFIED_PUBLIC">;
    createdAt: number;
    expiresAt?: number;
    snapshotId: string;

    intelligenceSummary: {
      primaryStyle: string;
      scoreLabel: string;
      summary: string;
    };

    intelligenceConfidence: {
      overall: number;
      tier: ConfidenceTier;
      sampleSize: number;
    };

    /** Compatibility only; canonical view is style/quality/risk + confidence. */
    trustScore: number;
    behavioral: {
      jeetIndex: number;
      rugExposureIndex: number;
      avgHoldingTimeSec: number;
      tradeFreqScore: number;
      evidenceSources: string;
      /** @deprecated transitional alias only */
      confidenceLabel?: string;
    } | null;
  
    badges: string[];
  };
  
  export type ArenaAgentSurfaceDTO = {
    rank: number;
    id: string;
    address: string;
    username: string;
  
    trustScore: number;
    isOptedIn: boolean;
    identityState: string;
  
    latestSnapshotId?: string | null;
    primaryStyle?: string | null;
    scoreLabel?: string | null;
    qualityOverall?: number | null;
    suspiciousness?: number | null;
    confidenceTier?: ConfidenceTier | null;
  };
  
  export type PublicProfileLookupResult =
    | { ok: true; profile: PublicProfileDTO }
    | { ok: false; code: "invalid_address" | "not_public" | "snapshot_unavailable" | "not_found" };