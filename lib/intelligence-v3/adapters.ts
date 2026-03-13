import type {
    ConfidenceTier,
    IntelligenceConfidence,
    IntelligenceReportV3,
    IntelligenceSummary,
    QualityScores,
    RiskScores,
    StyleScores,
  } from "@/types";
  
  export type LegacyProjectedSurface = {
    styleScores: StyleScores;
    qualityScores: QualityScores;
    riskScores: RiskScores;
    intelligenceConfidence: IntelligenceConfidence;
    intelligenceSummary: IntelligenceSummary;
  };
  
  /**
   * Transitional adapter only.
   *
   * Converts canonical v3 behavioral intelligence into the current legacy UI surface.
   * This is a projection bridge, not a source of truth.
   *
   * Rules:
   * - v3 remains canonical
   * - legacy fields are derived for compatibility only
   * - do not reverse-derive v3 from these outputs
   */
  export function projectV3ToLegacySurface(
    report: IntelligenceReportV3,
  ): LegacyProjectedSurface {
    const styleScores = projectStyleScores(report);
    const qualityScores = projectQualityScores(report);
    const riskScores = projectRiskScores(report);
    const intelligenceConfidence = projectConfidence(report);
    const intelligenceSummary = projectSummary(
      report,
      qualityScores,
      riskScores,
      intelligenceConfidence,
    );
  
    return {
      styleScores,
      qualityScores,
      riskScores,
      intelligenceConfidence,
      intelligenceSummary,
    };
  }
  
  function projectStyleScores(report: IntelligenceReportV3): StyleScores {
    const convictionDim = report.axes.style.dimensions.conviction;
    const rotationDim = report.axes.style.dimensions.rotation;
    const momentumDim = report.axes.style.dimensions.momentum;
    const patienceDim = report.axes.style.dimensions.patience;
    const opportunismDim = report.axes.style.dimensions.opportunism;
  
    const fastFlip = report.signals.positions.fastFlipRatio.value;
    const concentration = report.signals.positions.concentrationIndex.value;
    const churn = report.signals.rotation.tokenChurnRate.value;
    const breakout = threeTierToScore(
      report.signals.marketPosture.breakoutChaseTendency.value,
    );
    const tempo = threeTierToScore(report.signals.activity.txTempo.value);
    const holdLongness = holdTierToLongnessScore(
      report.signals.positions.medianHoldDurationTier.value,
    );
    const holdShortness = holdTierToShortnessScore(
      report.signals.positions.medianHoldDurationTier.value,
    );
  
    const sniperRaw =
      momentumDim * 0.34 +
        breakout * 0.24 +
        opportunismDim * 0.18 +
        fastFlip * 0.12 +
        holdShortness * 0.12;
    const rotationDominance = Math.max(0, rotationDim - momentumDim);
    const churnPenalty = churn > 65 ? (churn - 65) * 0.15 : 0;
    const sniper = clamp0to100(sniperRaw - rotationDominance * 0.35 - churnPenalty);

    const scalper = clamp0to100(
      rotationDim * 0.30 +
        churn * 0.18 +
        fastFlip * 0.20 +
        tempo * 0.16 +
        opportunismDim * 0.16,
    );
  
    const swing = clamp0to100(
      patienceDim * 0.30 +
        report.axes.adaptation.overall * 0.25 +
        holdLongness * 0.20 +
        invert100(tempo) * 0.15 +
        report.signals.activity.activeDaysRatio.value * 0.10,
    );
  
    const conviction = clamp0to100(
      convictionDim * 0.60 +
        holdLongness * 0.20 +
        concentration * 0.10 +
        invert100(churn) * 0.10,
    );
  
    return {
      sniper,
      scalper,
      swing,
      conviction,
    };
  }
  
  function projectQualityScores(report: IntelligenceReportV3): QualityScores {
    const activeDays = report.signals.activity.activeDaysRatio.value;
    const burstiness = report.signals.activity.sessionBurstiness.value;
    const holdLongness = holdTierToLongnessScore(
      report.signals.positions.medianHoldDurationTier.value,
    );
  
    const consistency = clamp0to100(
      report.axes.quality.overall * 0.45 +
        activeDays * 0.30 +
        report.axes.credibility.overall * 0.15 +
        invert100(burstiness) * 0.10,
    );
  
    /**
     * Legacy bridge only:
     * v3 has no canonical PnL-quality concept.
     * We project a compatibility scalar from behavioral quality/risk/adaptation.
     */
    const pnlQuality = clamp0to100(
      report.axes.quality.overall * 0.75 +
        report.axes.adaptation.overall * 0.10 +
        invert100(report.axes.risk.overall) * 0.15,
    );
  
    const longevity = clamp0to100(
      report.axes.credibility.overall * 0.55 +
        holdLongness * 0.25 +
        activeDays * 0.20,
    );
  
    return {
      consistency,
      pnlQuality,
      longevity,
      overall: clamp0to100(report.axes.quality.overall),
    };
  }
  
  function projectRiskScores(report: IntelligenceReportV3): RiskScores {
    const churn = clamp0to100(report.signals.rotation.tokenChurnRate.value);
  
    const microcap = threeTierToScore(report.signals.risk.microcapExposureTier.value);
    const illiquid = threeTierToScore(report.signals.risk.illiquidExposureTier.value);
    const panic = threeTierToScore(report.signals.risk.panicExitPattern.value);
    const breakout = threeTierToScore(
      report.signals.marketPosture.breakoutChaseTendency.value,
    );
  
    const rugExposure = clamp0to100(
      microcap * 0.45 + illiquid * 0.35 + panic * 0.20,
    );
  
    const suspiciousness = clamp0to100(
      churn * 0.35 +
        rugExposure * 0.45 +
        breakout * 0.10 +
        report.axes.risk.overall * 0.10,
    );
  
    return {
      churn,
      rugExposure,
      suspiciousness,
    };
  }
  
  function projectConfidence(report: IntelligenceReportV3): IntelligenceConfidence {
    const coverageScore = coverageTierToScore(report.coverage.tier);
  
    let overall = clamp0to100(
      report.axes.credibility.overall * 0.70 + coverageScore * 0.30,
    );
  
    if (report.axes.credibility.status === "INSUFFICIENT") {
      overall = Math.min(overall, 35);
    } else if (report.axes.credibility.status === "ESTIMATED") {
      overall = Math.min(overall, 70);
    }
  
    return {
      overall,
      tier: overallToConfidenceTier(overall),
      sampleSize: report.coverage.txSampleSize,
    };
  }
  
  function projectSummary(
    report: IntelligenceReportV3,
    qualityScores: QualityScores,
    riskScores: RiskScores,
    confidence: IntelligenceConfidence,
  ): IntelligenceSummary {
    const primaryStyle = legacyPrimaryStyleLabel(report.primaryStyle.label);
    const scoreLabel = buildLegacyScoreLabel(
      primaryStyle,
      qualityScores.overall,
      riskScores.suspiciousness,
      confidence.tier,
    );
  
    return {
      primaryStyle,
      scoreLabel,
      summary: report.summary.description,
    };
  }
  
  function legacyPrimaryStyleLabel(label: IntelligenceReportV3["primaryStyle"]["label"]): string {
    switch (label) {
      case "CONVICTION_LED":
        return "Conviction Holder";
      case "ROTATION_LED":
        return "Fast Churn Trader";
      case "MOMENTUM_REACTIVE":
        return "High-Frequency Sniper";
      case "OPPORTUNISTIC":
        return "Opportunistic Trader";
      case "PASSIVE_ALLOCATOR":
        return "Passive Allocator";
      case "INSUFFICIENT_DATA":
        return "Unclassified";
    }
  }
  
  function buildLegacyScoreLabel(
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
  
  function overallToConfidenceTier(overall: number): ConfidenceTier {
    if (overall >= 75) return "HIGH";
    if (overall >= 45) return "MEDIUM";
    return "LOW";
  }
  
  function coverageTierToScore(
    tier: IntelligenceReportV3["coverage"]["tier"],
  ): number {
    switch (tier) {
      case "HIGH":
        return 85;
      case "MEDIUM":
        return 60;
      case "LOW":
        return 35;
    }
  }
  
  function threeTierToScore(value: "LOW" | "MEDIUM" | "HIGH"): number {
    switch (value) {
      case "LOW":
        return 25;
      case "MEDIUM":
        return 50;
      case "HIGH":
        return 75;
    }
  }
  
  function holdTierToShortnessScore(
    value: "VERY_SHORT" | "SHORT" | "MEDIUM" | "LONG",
  ): number {
    switch (value) {
      case "VERY_SHORT":
        return 90;
      case "SHORT":
        return 70;
      case "MEDIUM":
        return 45;
      case "LONG":
        return 15;
    }
  }
  
  function holdTierToLongnessScore(
    value: "VERY_SHORT" | "SHORT" | "MEDIUM" | "LONG",
  ): number {
    switch (value) {
      case "VERY_SHORT":
        return 10;
      case "SHORT":
        return 25;
      case "MEDIUM":
        return 55;
      case "LONG":
        return 85;
    }
  }
  
  function invert100(value: number): number {
    return clamp0to100(100 - clamp0to100(value));
  }
  
  function clamp0to100(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }