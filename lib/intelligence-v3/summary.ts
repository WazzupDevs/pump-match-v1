import type {
    BehavioralAxes,
    BehavioralProfile,
    CoverageAssessment,
    DeterministicSummary,
    IntelligenceBadgeV3,
    PrimaryStyleClassification,
    PrimaryStyleLabel,
  } from "@/types/intelligence-report-v3";
  import type { ExtractedBehavioralSignalsV3 } from "./signals";
  
  export function buildBehavioralProfileV3(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
    primaryStyle: PrimaryStyleClassification,
  ): BehavioralProfile {
    const pace = derivePace(extracted);
    const convictionProfile = deriveConvictionProfile(extracted);
    const riskPosture = deriveRiskPosture(axes.risk.overall);
    const adaptationProfile = deriveAdaptationProfile(axes.adaptation.overall);
  
    return {
      operatorType: mapPrimaryStyleToOperatorType(primaryStyle.label),
      pace,
      convictionProfile,
      riskPosture,
      adaptationProfile,
    };
  }
  
  export function buildDeterministicSummaryV3(params: {
    extracted: ExtractedBehavioralSignalsV3;
    axes: BehavioralAxes;
    primaryStyle: PrimaryStyleClassification;
    coverage: CoverageAssessment;
    badges: readonly IntelligenceBadgeV3[];
  }): DeterministicSummary {
    const { extracted, axes, primaryStyle, coverage, badges } = params;
  
    const headline = buildHeadline(primaryStyle.label, axes, coverage);
    const description = buildDescription(
      extracted,
      axes,
      primaryStyle,
      coverage,
      badges,
    );
    const keyPoints = buildKeyPoints(
      extracted,
      axes,
      primaryStyle,
      coverage,
      badges,
    );
  
    return {
      headline,
      description,
      keyPoints,
    };
  }
  
  function buildHeadline(
    primaryStyle: PrimaryStyleLabel,
    axes: BehavioralAxes,
    coverage: CoverageAssessment,
  ): string {
    const styleLabel = formatPrimaryStyleLabel(primaryStyle);
    const qualityLabel = axisBandLabel(axes.quality.overall, "quality");
    const riskLabel = axisBandLabel(axes.risk.overall, "risk");
    const coverageLabel = coverage.tier;
  
    return `${styleLabel} · ${qualityLabel} · ${riskLabel} · ${coverageLabel} coverage`;
  }
  
  function buildDescription(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
    primaryStyle: PrimaryStyleClassification,
    coverage: CoverageAssessment,
    badges: readonly IntelligenceBadgeV3[],
  ): string {
    const styleSentence = buildStyleSentence(extracted, primaryStyle);
    const riskSentence = buildRiskSentence(axes, badges);
    const coverageSentence = buildCoverageSentence(coverage, axes);
  
    return `${styleSentence} ${riskSentence} ${coverageSentence}`;
  }
  
  function buildKeyPoints(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
    primaryStyle: PrimaryStyleClassification,
    coverage: CoverageAssessment,
    badges: readonly IntelligenceBadgeV3[],
  ): readonly string[] {
    const points: string[] = [];
  
    points.push(buildPrimaryBehaviorPoint(extracted, primaryStyle));
  
    const badgePoint = buildBadgePoint(badges);
    if (badgePoint) {
      points.push(badgePoint);
    } else {
      points.push(buildRiskDisciplinePoint(axes));
    }
  
    points.push(buildCoveragePoint(coverage, axes));
  
    return points.slice(0, 3);
  }
  
  function buildStyleSentence(
    extracted: ExtractedBehavioralSignalsV3,
    primaryStyle: PrimaryStyleClassification,
  ): string {
    const holdTier = extracted.signals.positions.medianHoldDurationTier.value;
    const churn = extracted.signals.rotation.tokenChurnRate.value;
    const momentum = extracted.signals.marketPosture.momentumParticipation.value;
    const breakout = extracted.signals.marketPosture.breakoutChaseTendency.value;
    const concentration = extracted.signals.positions.concentrationIndex.value;
  
    switch (primaryStyle.label) {
      case "CONVICTION_LED":
        return `This wallet shows a conviction-led pattern driven by concentrated positioning, ${holdTierToPhrase(
          holdTier,
        )}, and lower rotation pressure.`;
  
      case "ROTATION_LED":
        return `This wallet shows a rotation-led pattern driven by elevated token churn (${bandFromScore(
          churn,
        )}), shorter hold behavior, and repeated repositioning tendencies.`;
  
      case "MOMENTUM_REACTIVE":
        return `This wallet shows a momentum-reactive pattern driven by ${momentum.toLowerCase()} momentum participation, breakout sensitivity, and faster execution behavior.`;
  
      case "OPPORTUNISTIC":
        return `This wallet shows an opportunistic pattern driven by burstier execution, reactive entries, and mixed rotation behavior.`;
  
      case "PASSIVE_ALLOCATOR":
        return `This wallet shows a passive allocator pattern driven by longer hold behavior, lower execution tempo, and restrained churn.`;
      case "INSUFFICIENT_DATA":
        return "This wallet has insufficient on-chain behavioral data to derive a meaningful style classification. No closed positions and minimal transaction history were observed.";
    }
  }
  
  function buildRiskSentence(
    axes: BehavioralAxes,
    badges: readonly IntelligenceBadgeV3[],
  ): string {
    const riskBand = axisBandLabel(axes.risk.overall, "risk");
    const qualityBand = axisBandLabel(axes.quality.overall, "quality");
  
    const notableRiskBadge = badges.find(
      (badge) =>
        badge.code === "HIGH_MICROCAP_EXPOSURE" ||
        badge.code === "BREAKOUT_CHASER" ||
        badge.code === "CONCENTRATED_OPERATOR",
    );
  
    if (notableRiskBadge) {
      return `Risk posture is ${riskBand.toLowerCase()} with supporting evidence from ${notableRiskBadge.label.toLowerCase()} behavior, while execution discipline currently reads ${qualityBand.toLowerCase()}.`;
    }
  
    return `Risk posture is ${riskBand.toLowerCase()} while execution discipline currently reads ${qualityBand.toLowerCase()}.`;
  }
  
  function buildCoverageSentence(
    coverage: CoverageAssessment,
    axes: BehavioralAxes,
  ): string {
    if (coverage.tier === "HIGH") {
      return `Coverage is high, so the observed pattern is relatively well-supported across the current observation window.`;
    }
  
    if (coverage.tier === "MEDIUM") {
      return `Coverage is medium, so the pattern is visible but should still be treated as an evolving behavioral read.`;
    }
  
    const insufficientAxes = Object.entries(axes)
      .filter(([, axis]) => axis.status === "INSUFFICIENT")
      .map(([key]) => key);
  
    if (insufficientAxes.length > 0) {
      return `Coverage is limited, with insufficient support in ${insufficientAxes.join(
        ", ",
      )}, so this report should be treated conservatively.`;
    }
  
    return `Coverage is limited, so this report should be treated conservatively.`;
  }
  
  function buildPrimaryBehaviorPoint(
    extracted: ExtractedBehavioralSignalsV3,
    primaryStyle: PrimaryStyleClassification,
  ): string {
    const holdTier = extracted.signals.positions.medianHoldDurationTier.value;
    const churn = extracted.signals.rotation.tokenChurnRate.value;
    const concentration = extracted.signals.positions.concentrationIndex.value;
    const momentum = extracted.signals.marketPosture.momentumParticipation.value;
  
    switch (primaryStyle.label) {
      case "CONVICTION_LED":
        return `Primary behavior: concentrated positioning with ${holdTierToCompactPhrase(
          holdTier,
        )} and ${bandFromScore(invertBandBasis(churn))} rotation restraint.`;
  
      case "ROTATION_LED":
        return `Primary behavior: elevated rotation with ${bandFromScore(
          churn,
        )} churn and shorter hold bias.`;
  
      case "MOMENTUM_REACTIVE":
        return `Primary behavior: ${momentum.toLowerCase()} momentum participation with breakout-reactive execution.`;
  
      case "OPPORTUNISTIC":
        return `Primary behavior: opportunistic entries with mixed hold behavior and reactive timing.`;
  
      case "PASSIVE_ALLOCATOR":
        return `Primary behavior: patient allocation with ${bandFromScore(
          concentration,
        )} concentration and lower execution tempo.`;
      case "INSUFFICIENT_DATA":
        return "Primary behavior: insufficient data — no closed positions and minimal transaction history observed.";
    }
  }
  
  function buildBadgePoint(
    badges: readonly IntelligenceBadgeV3[],
  ): string | null {
    if (badges.length === 0) return null;
  
    const strongBadge = badges.find((badge) => badge.strength === "strong");
    const selected = strongBadge ?? badges[0];
  
    return `Notable signal: ${selected.label} — ${selected.reason}`;
  }
  
  function buildRiskDisciplinePoint(
    axes: BehavioralAxes,
  ): string {
    const qualityBand = axisBandLabel(axes.quality.overall, "quality");
    const riskBand = axisBandLabel(axes.risk.overall, "risk");
  
    return `Discipline and risk: ${qualityBand} execution discipline with ${riskBand.toLowerCase()} risk posture.`;
  }
  
  function buildCoveragePoint(
    coverage: CoverageAssessment,
    axes: BehavioralAxes,
  ): string {
    if (coverage.tier === "HIGH") {
      return `Coverage note: high data support across the current observation window.`;
    }
  
    if (coverage.tier === "MEDIUM") {
      return `Coverage note: medium support; current patterns are meaningful but not fully mature.`;
    }
  
    const insufficientAxes = Object.entries(axes)
      .filter(([, axis]) => axis.status === "INSUFFICIENT")
      .map(([key]) => key);
  
    if (insufficientAxes.length > 0) {
      return `Coverage note: limited support, especially in ${insufficientAxes.join(", ")}.`;
    }
  
    return `Coverage note: limited support; interpret this report conservatively.`;
  }
  
  function derivePace(
    extracted: ExtractedBehavioralSignalsV3,
  ): BehavioralProfile["pace"] {
    const tempo = extracted.signals.activity.txTempo.value;
    const burst = extracted.signals.activity.sessionBurstiness.value;
    const holdTier = extracted.signals.positions.medianHoldDurationTier.value;
  
    if (tempo === "HIGH" && burst >= 67) return "FAST";
    if (tempo === "LOW" && holdTier === "LONG") return "PATIENT";
    return "MODERATE";
  }
  
  function deriveConvictionProfile(
    extracted: ExtractedBehavioralSignalsV3,
  ): BehavioralProfile["convictionProfile"] {
    const concentration = extracted.signals.positions.concentrationIndex.value;
    const holdTier = extracted.signals.positions.medianHoldDurationTier.value;
    const churn = extracted.signals.rotation.tokenChurnRate.value;
  
    if (concentration >= 70 && holdTier === "LONG" && churn <= 35) {
      return "HIGH_CONVICTION";
    }
  
    if (concentration >= 45 || holdTier === "MEDIUM") {
      return "MIXED_CONVICTION";
    }
  
    return "LOW_CONVICTION";
  }
  
  function deriveRiskPosture(
    riskOverall: number,
  ): BehavioralProfile["riskPosture"] {
    if (riskOverall >= 67) return "AGGRESSIVE";
    if (riskOverall >= 34) return "ELEVATED";
    return "CONTROLLED";
  }
  
  function deriveAdaptationProfile(
    adaptationOverall: number,
  ): BehavioralProfile["adaptationProfile"] {
    if (adaptationOverall >= 67) return "HIGHLY_ADAPTIVE";
    if (adaptationOverall >= 34) return "RESPONSIVE";
    return "STICKY";
  }
  
  function mapPrimaryStyleToOperatorType(
    label: PrimaryStyleLabel,
  ): BehavioralProfile["operatorType"] {
    switch (label) {
      case "CONVICTION_LED":
        return "CONVICTION_OPERATOR";
      case "ROTATION_LED":
        return "ROTATION_OPERATOR";
      case "MOMENTUM_REACTIVE":
        return "MOMENTUM_OPERATOR";
      case "OPPORTUNISTIC":
        return "OPPORTUNISTIC_OPERATOR";
      case "PASSIVE_ALLOCATOR":
        return "ALLOCATOR";
      case "INSUFFICIENT_DATA":
        // Most conservative existing operator type; primary label conveys true state.
        return "ALLOCATOR";
    }
  }
  
  function axisBandLabel(
    score: number,
    axis: "quality" | "risk",
  ): string {
    if (axis === "quality") {
      if (score >= 67) return "Strong Quality";
      if (score >= 34) return "Mixed Quality";
      return "Fragile Quality";
    }
  
    if (score >= 67) return "Elevated Risk";
    if (score >= 34) return "Moderate Risk";
    return "Controlled Risk";
  }
  
  function formatPrimaryStyleLabel(
    label: PrimaryStyleLabel,
  ): string {
    switch (label) {
      case "CONVICTION_LED":
        return "Conviction-led";
      case "ROTATION_LED":
        return "Rotation-led";
      case "MOMENTUM_REACTIVE":
        return "Momentum-reactive";
      case "OPPORTUNISTIC":
        return "Opportunistic";
      case "PASSIVE_ALLOCATOR":
        return "Passive allocator";
      case "INSUFFICIENT_DATA":
        return "Unclassified";
    }
  }
  
  function holdTierToPhrase(
    value: "VERY_SHORT" | "SHORT" | "MEDIUM" | "LONG",
  ): string {
    switch (value) {
      case "VERY_SHORT":
        return "very short hold behavior";
      case "SHORT":
        return "shorter hold behavior";
      case "MEDIUM":
        return "medium hold behavior";
      case "LONG":
        return "longer hold behavior";
    }
  }
  
  function holdTierToCompactPhrase(
    value: "VERY_SHORT" | "SHORT" | "MEDIUM" | "LONG",
  ): string {
    switch (value) {
      case "VERY_SHORT":
        return "very short holding periods";
      case "SHORT":
        return "short holding periods";
      case "MEDIUM":
        return "mixed holding periods";
      case "LONG":
        return "longer holding periods";
    }
  }
  
  function bandFromScore(score: number): string {
    if (score >= 67) return "high";
    if (score >= 34) return "medium";
    return "low";
  }
  
  function invertBandBasis(score: number): number {
    return Math.max(0, Math.min(100, 100 - score));
  }