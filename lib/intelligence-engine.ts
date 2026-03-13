import type { OnchainCore } from "@/types/intelligence-core";
import type {
  ModelVersion,
  ScoreWindow,
  ConfidenceTier,
  StyleScores,
  QualityScores,
  RiskScores,
  IntelligenceConfidence,
  IntelligenceReport,
  BehavioralFeatures,
  ScoreSnapshot,
} from "@/types/intelligence";

export function clamp0to100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeBehavioralFeatures(core: OnchainCore): BehavioralFeatures | null {
  const { pumpStats, transactionCount, approxWalletAgeDays } = core;

  const hasPump = pumpStats != null && pumpStats.pumpMintsTouched >= 1;
  const bestHoldTime =
    core.generalMedianHoldTimeSeconds ?? pumpStats?.medianHoldTimeSeconds ?? null;

  // Need at least some behavioral basis to produce features
  if (!hasPump && bestHoldTime == null && transactionCount <= 0) {
    return null;
  }

  // Prefer pump-specific jeet/rug when available; derive from general hold time otherwise
  const jeetIndex = hasPump
    ? pumpStats.jeetScore
    : jeetIndexFromHoldTime(bestHoldTime);
  // Rug exposure is pump.fun-specific (dead bag ratio). Neutral for non-pump wallets.
  const rugExposureIndex = hasPump ? pumpStats.rugMagnetScore : 0;

  const avgHoldingTimeSec =
    bestHoldTime != null && bestHoldTime > 0 ? bestHoldTime : undefined;

  const closedPositions =
    core.generalClosedPositions ?? pumpStats?.closedPositions ?? 0;

  const directionalTxCount = core.generalDirectionalTxCount ?? transactionCount;
  let tradeFreqScore: number | undefined;
  if (approxWalletAgeDays != null && approxWalletAgeDays > 0) {
    const closedTradesPerDay = closedPositions / approxWalletAgeDays;
    const generalTradesPerDay = directionalTxCount / approxWalletAgeDays;
    tradeFreqScore = clamp0to100(
      Math.max(closedTradesPerDay * 20, generalTradesPerDay * 5),
    );
  } else if (transactionCount > 0) {
    tradeFreqScore = clamp0to100(
      Math.max(closedPositions * 5, Math.min(directionalTxCount, 100)),
    );
  }

  const sources: string[] = ["Helius Enhanced TX"];
  if (hasPump && pumpStats.closedPositions >= 3) sources.push("Pump Simulation");
  if (core.generalClosedPositions != null && core.generalClosedPositions >= 3)
    sources.push("General Lifecycle");
  if (approxWalletAgeDays != null) sources.push("Wallet Age");
  const evidenceSources = sources.join(" + ");

  return {
    jeetIndex,
    rugExposureIndex,
    avgHoldingTimeSec,
    tradeFreqScore,
    evidenceSources,
  };
}

function jeetIndexFromHoldTime(holdTimeSec: number | null): number {
  if (holdTimeSec == null || holdTimeSec <= 0) return 50; // neutral when unknown
  if (holdTimeSec <= 120) return 100;
  if (holdTimeSec <= 300) return 90;
  if (holdTimeSec <= 900) return 75;
  if (holdTimeSec <= 3600) return 50;
  if (holdTimeSec <= 14400) return 30;
  if (holdTimeSec <= 86400) return 10;
  return 0;
}

export function computeConfidence(sampleSize: number): IntelligenceConfidence {
  let tier: ConfidenceTier = "LOW";
  let overall = 35;

  if (sampleSize >= 25) {
    tier = "HIGH";
    overall = 85;
  } else if (sampleSize >= 8) {
    tier = "MEDIUM";
    overall = 60;
  }

  return {
    overall,
    tier,
    sampleSize,
  };
}

export function computeStyleScores(
  core: OnchainCore,
  behavioral: BehavioralFeatures | null,
): StyleScores {
  const pump = core.pumpStats;

  const sniper = clamp0to100(
    ((pump?.closedPositions ?? 0) >= 5 ? 35 : 0) +
      ((behavioral?.tradeFreqScore ?? 0) * 0.45) +
      ((behavioral?.jeetIndex ?? 0) * 0.3),
  );

  const scalper = clamp0to100(
    ((behavioral?.jeetIndex ?? 0) * 0.55) +
      ((behavioral?.tradeFreqScore ?? 0) * 0.35),
  );

  const conviction = clamp0to100(
    (behavioral?.avgHoldingTimeSec
      ? Math.min(100, behavioral.avgHoldingTimeSec / 1800)
      : 0) *
      0.55 +
      Math.max(0, 100 - (behavioral?.jeetIndex ?? 0)) * 0.3 +
      Math.max(0, 100 - (behavioral?.rugExposureIndex ?? 0)) * 0.15,
  );

  const swing = clamp0to100(
    conviction * 0.55 +
      Math.max(0, 100 - (behavioral?.tradeFreqScore ?? 0)) * 0.2 +
      Math.min(core.tokenDiversity * 4, 100) * 0.25,
  );

  return {
    sniper,
    scalper,
    swing,
    conviction,
  };
}

export function computeQualityScores(
  core: OnchainCore,
  behavioral: BehavioralFeatures | null,
): QualityScores {
  const tx = Math.max(0, core.transactionCount);
  const sampleQuality = Math.min(100, tx / 8);

  const consistency = clamp0to100(
    sampleQuality * 0.45 +
      Math.max(0, 100 - (behavioral?.rugExposureIndex ?? 0)) * 0.3 +
      Math.max(0, 100 - (behavioral?.jeetIndex ?? 0)) * 0.25,
  );

  const pnlQuality = clamp0to100(
    Math.max(0, 100 - (behavioral?.rugExposureIndex ?? 0)) * 0.55 +
      Math.min(core.tokenDiversity * 5, 100) * 0.2 +
      Math.min((core.portfolioValueUsd ?? 0) / 50, 100) * 0.25,
  );

  const longevity = clamp0to100(
    Math.min((core.approxWalletAgeDays ?? 0) / 3, 100) * 0.7 +
      sampleQuality * 0.3,
  );

  const overall = clamp0to100(
    consistency * 0.4 + pnlQuality * 0.3 + longevity * 0.3,
  );

  return {
    consistency,
    pnlQuality,
    longevity,
    overall,
  };
}

export function computeRiskScores(
  _core: OnchainCore,
  behavioral: BehavioralFeatures | null,
): RiskScores {
  const churn = clamp0to100(behavioral?.jeetIndex ?? 0);
  const rugExposure = clamp0to100(behavioral?.rugExposureIndex ?? 0);
  const suspiciousness = clamp0to100(churn * 0.5 + rugExposure * 0.5);

  return {
    churn,
    rugExposure,
    suspiciousness,
  };
}

export function classifyPrimaryStyle(styleScores: StyleScores): string {
  const entries: [string, number][] = [
    ["High-Frequency Sniper", styleScores.sniper],
    ["Fast Churn Trader", styleScores.scalper],
    ["Swing Trader", styleScores.swing],
    ["Conviction Holder", styleScores.conviction],
  ];

  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

export function buildScoreLabel(
  primaryStyle: string,
  qualityOverall: number,
  suspiciousness: number,
  confidenceTier: ConfidenceTier,
): string {
  const qualityText =
    qualityOverall >= 75
      ? "Strong Quality"
      : qualityOverall >= 50
        ? "Moderate Quality"
        : "Early Quality";

  const riskText =
    suspiciousness < 35
      ? "Low Risk"
      : suspiciousness < 60
        ? "Moderate Risk"
        : "Elevated Risk";

  return `${primaryStyle} · ${qualityText} · ${riskText} · ${confidenceTier}`;
}

export function buildSummary(
  primaryStyle: string,
  qualityOverall: number,
  suspiciousness: number,
  confidenceTier: ConfidenceTier,
): ScoreSnapshot["summary"] {
  let qualityText = "mixed quality";
  if (qualityOverall >= 75) qualityText = "strong quality";
  else if (qualityOverall >= 50) qualityText = "moderate quality";

  let riskText = "elevated suspiciousness";
  if (suspiciousness < 35) riskText = "low suspiciousness";
  else if (suspiciousness < 60) riskText = "moderate suspiciousness";

  const scoreLabel = buildScoreLabel(
    primaryStyle,
    qualityOverall,
    suspiciousness,
    confidenceTier,
  );

  const summary = `${primaryStyle} with ${qualityText}, ${riskText}, and ${confidenceTier.toLowerCase()} confidence.`;

  return {
    primaryStyle,
    scoreLabel,
    summary,
  };
}

export function computeLegacyTrustScore(
  legacyScore: number,
  qualityOverall: number,
  suspiciousness: number,
  confidenceOverall: number,
): number {
  return clamp0to100(
    legacyScore * 0.45 +
      qualityOverall * 0.3 +
      Math.max(0, 100 - suspiciousness) * 0.15 +
      confidenceOverall * 0.1,
  );
}

export function computeIntelligenceReport(
  core: OnchainCore,
  modelVersion: ModelVersion = "v2.0",
  scoreWindow: ScoreWindow = "all",
): IntelligenceReport {
  const behavioral = computeBehavioralFeatures(core);
  const style = computeStyleScores(core, behavioral);
  const quality = computeQualityScores(core, behavioral);
  const risk = computeRiskScores(core, behavioral);

  // Prefer general closed positions (all tokens) over pump-only positions
  const rawSample =
    core.generalClosedPositions ??
    core.pumpStats?.closedPositions ??
    Math.max(0, Math.min(core.transactionCount, 100));
  const sampleSize = Math.max(0, rawSample ?? 0);

  const confidence = computeConfidence(sampleSize);
  const primaryStyle = classifyPrimaryStyle(style);
  const summary = buildSummary(
    primaryStyle,
    quality.overall,
    risk.suspiciousness,
    confidence.tier,
  );

  const legacyScore = core.scoreBreakdown.total;
  const legacyTrustScore = computeLegacyTrustScore(
    legacyScore,
    quality.overall,
    risk.suspiciousness,
    confidence.overall,
  );

  const snapshot: ScoreSnapshot = {
    id: "",
    walletAddress: "",
    modelVersion,
    scoreWindow,
    style,
    quality,
    risk,
    confidence,
    summary,
    sampleSize,
    computedAt: Date.now(),
  };

  return {
    snapshot,
    behavioral,
    legacyTrustScore,
  };
}

