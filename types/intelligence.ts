export type ModelVersion = "v2.0" | "v2.1";

export type ScoreWindow = "7d" | "30d" | "90d" | "all";

export type VisibilityMode =
  | "GHOST"
  | "CLAIMED_PRIVATE"
  | "PUBLIC"
  | "VERIFIED_PUBLIC";

export type ConfidenceTier = "LOW" | "MEDIUM" | "HIGH";

export type StyleScores = {
  sniper: number;
  scalper: number;
  swing: number;
  conviction: number;
};

export type QualityScores = {
  consistency: number;
  pnlQuality: number;
  longevity: number;
  overall: number;
};

export type RiskScores = {
  churn: number;
  rugExposure: number;
  suspiciousness: number;
};

export type IntelligenceConfidence = {
  overall: number;
  tier: ConfidenceTier;
  sampleSize: number;
};

export type IntelligenceSummary = {
  primaryStyle: string;
  scoreLabel: string;
  summary: string;
};

export type BehavioralFeatures = {
  jeetIndex: number;
  rugExposureIndex: number;
  avgHoldingTimeSec?: number;
  tradeFreqScore?: number;
  evidenceSources: string;
};

export type ScoreSnapshot = {
  id: string;
  walletAddress: string;
  modelVersion: ModelVersion;
  scoreWindow: ScoreWindow;
  style: StyleScores;
  quality: QualityScores;
  risk: RiskScores;
  confidence: IntelligenceConfidence;
  summary: IntelligenceSummary;
  sampleSize: number;
  computedAt: number;
};

export type IntelligenceReport = {
  snapshot: ScoreSnapshot;
  behavioral: BehavioralFeatures | null;
  legacyTrustScore: number;
};

export type WalletReceipt = {
  id: string;
  shareId: string;
  walletAddress: string;
  snapshotId: string;
  visibility: VisibilityMode;
  createdAt: number;
  expiresAt?: number;
};

export type ArenaBridgeFields = {
  latestSnapshotId: string | null;
  primaryStyle: string | null;
  qualityOverall: number | null;
  suspiciousness: number | null;
  confidenceTier: ConfidenceTier | null;
  scoreLabel: string | null;
};

