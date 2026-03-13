import type {
    BehavioralAxes,
    IntelligenceBadgeV3,
    PrimaryStyleLabel,
  } from "@/types/intelligence-report-v3";
  import type { ExtractedBehavioralSignalsV3, SignalPath } from "./signals";
  
  type BadgeCode =
    | "FAST_ROTATOR"
    | "HIGH_CONVICTION"
    | "MOMENTUM_PARTICIPANT"
    | "BREAKOUT_CHASER"
    | "HIGH_MICROCAP_EXPOSURE"
    | "CONCENTRATED_OPERATOR";
  
  type BadgeCandidate = {
    code: BadgeCode;
    label: string;
    reason: string;
    strength: "soft" | "strong";
    evidence: readonly { sourceType: "signal" | "axis"; sourcePath: string }[];
  };
  
  export function computeIntelligenceBadgesV3(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
    primaryStyle: PrimaryStyleLabel,
  ): readonly IntelligenceBadgeV3[] {
    if (axes.credibility.status === "INSUFFICIENT") {
      return [];
    }
  
    const badges: IntelligenceBadgeV3[] = [];
  
    const fastRotator = buildFastRotatorBadge(extracted, axes);
    if (fastRotator) badges.push(fastRotator);
  
    const highConviction = buildHighConvictionBadge(extracted, axes, primaryStyle);
    if (highConviction) badges.push(highConviction);
  
    const momentumParticipant = buildMomentumParticipantBadge(extracted, axes);
    if (momentumParticipant) badges.push(momentumParticipant);
  
    const breakoutChaser = buildBreakoutChaserBadge(extracted, axes);
    if (breakoutChaser) badges.push(breakoutChaser);
  
    const highMicrocapExposure = buildHighMicrocapExposureBadge(extracted, axes);
    if (highMicrocapExposure) badges.push(highMicrocapExposure);
  
    const concentratedOperator = buildConcentratedOperatorBadge(extracted, axes);
    if (concentratedOperator) badges.push(concentratedOperator);
  
    return badges;
  }
  
  function buildFastRotatorBadge(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
  ): IntelligenceBadgeV3 | null {
    if (axes.style.status === "INSUFFICIENT") return null;
  
    const churn = extracted.signals.rotation.tokenChurnRate.value;
    const fastFlip = extracted.signals.positions.fastFlipRatio.value;
    const holdTier = extracted.signals.positions.medianHoldDurationTier.value;
  
    const supportingPaths: SignalPath[] = [
      "rotation.tokenChurnRate",
      "positions.fastFlipRatio",
      "positions.medianHoldDurationTier",
    ];
  
    if (!hasSupport(extracted, supportingPaths, 2)) return null;
    if (churn < 70 || fastFlip < 60) return null;
  
    const strong = holdTier === "VERY_SHORT" || holdTier === "SHORT";
  
    return toBadge({
      code: "FAST_ROTATOR",
      label: "Fast Rotator",
      reason: strong
        ? "High token churn, fast exits, and short hold behavior indicate strong rotation-led behavior."
        : "High token churn and fast exits indicate elevated rotation behavior.",
      strength: strong ? "strong" : "soft",
      evidence: [
        signalEvidence("rotation.tokenChurnRate"),
        signalEvidence("positions.fastFlipRatio"),
        signalEvidence("positions.medianHoldDurationTier"),
        axisEvidence("axes.style"),
      ],
    });
  }
  
  function buildHighConvictionBadge(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
    primaryStyle: PrimaryStyleLabel,
  ): IntelligenceBadgeV3 | null {
    if (axes.style.status === "INSUFFICIENT") return null;
  
    const concentration = extracted.signals.positions.concentrationIndex.value;
    const holdTier = extracted.signals.positions.medianHoldDurationTier.value;
    const churn = extracted.signals.rotation.tokenChurnRate.value;
    const activeDays = extracted.signals.activity.activeDaysRatio.value;
  
    const supportingPaths: SignalPath[] = [
      "positions.concentrationIndex",
      "positions.medianHoldDurationTier",
      "rotation.tokenChurnRate",
      "activity.activeDaysRatio",
    ];
  
    if (!hasSupport(extracted, supportingPaths, 3)) return null;
    if (concentration < 70 || holdTier !== "LONG" || churn > 35) return null;
  
    const strong = activeDays >= 55 || primaryStyle === "CONVICTION_LED";
  
    return toBadge({
      code: "HIGH_CONVICTION",
      label: "High Conviction",
      reason: strong
        ? "Concentrated positioning, longer hold behavior, and low churn indicate strong conviction-led behavior."
        : "Concentrated positioning and longer hold behavior indicate elevated conviction.",
      strength: strong ? "strong" : "soft",
      evidence: [
        signalEvidence("positions.concentrationIndex"),
        signalEvidence("positions.medianHoldDurationTier"),
        signalEvidence("rotation.tokenChurnRate"),
        signalEvidence("activity.activeDaysRatio"),
        axisEvidence("axes.style"),
      ],
    });
  }
  
  function buildMomentumParticipantBadge(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
  ): IntelligenceBadgeV3 | null {
    if (axes.style.status === "INSUFFICIENT") return null;
  
    const momentum = threeTierToScore(
      extracted.signals.marketPosture.momentumParticipation.value,
    );
    const breakout = threeTierToScore(
      extracted.signals.marketPosture.breakoutChaseTendency.value,
    );
  
    const supportingPaths: SignalPath[] = [
      "marketPosture.momentumParticipation",
      "marketPosture.breakoutChaseTendency",
    ];
  
    if (!hasSupport(extracted, supportingPaths, 1)) return null;
    if (momentum < 70) return null;
  
    const strong = breakout >= 60;
  
    return toBadge({
      code: "MOMENTUM_PARTICIPANT",
      label: "Momentum Participant",
      reason: strong
        ? "Strong momentum participation with supporting breakout-chasing behavior indicates reactive trend participation."
        : "Momentum participation suggests trend-reactive behavior.",
      strength: strong ? "strong" : "soft",
      evidence: [
        signalEvidence("marketPosture.momentumParticipation"),
        signalEvidence("marketPosture.breakoutChaseTendency"),
        axisEvidence("axes.style"),
      ],
    });
  }
  
  function buildBreakoutChaserBadge(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
  ): IntelligenceBadgeV3 | null {
    if (axes.style.status === "INSUFFICIENT") return null;
  
    const breakout = threeTierToScore(
      extracted.signals.marketPosture.breakoutChaseTendency.value,
    );
    const fastFlip = extracted.signals.positions.fastFlipRatio.value;
  
    const supportingPaths: SignalPath[] = [
      "marketPosture.breakoutChaseTendency",
      "positions.fastFlipRatio",
    ];
  
    if (!hasSupport(extracted, supportingPaths, 1)) return null;
    if (breakout < 72) return null;
  
    const strong = fastFlip >= 55;
  
    return toBadge({
      code: "BREAKOUT_CHASER",
      label: "Breakout Chaser",
      reason: strong
        ? "Breakout-chasing tendency with faster exits indicates reactive participation after price expansion."
        : "Breakout-chasing tendency suggests reactive entry behavior.",
      strength: strong ? "strong" : "soft",
      evidence: [
        signalEvidence("marketPosture.breakoutChaseTendency"),
        signalEvidence("positions.fastFlipRatio"),
        axisEvidence("axes.style"),
      ],
    });
  }
  
  function buildHighMicrocapExposureBadge(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
  ): IntelligenceBadgeV3 | null {
    if (axes.risk.status === "INSUFFICIENT") return null;
  
    const microcapTier = extracted.signals.risk.microcapExposureTier.value;
    const illiquidTier = extracted.signals.risk.illiquidExposureTier.value;
  
    // Avoid aggressive badgeing on pure UNAVAILABLE risk inputs.
    if (
      extracted.support["risk.microcapExposureTier"] === "UNAVAILABLE" &&
      extracted.support["risk.illiquidExposureTier"] === "UNAVAILABLE"
    ) {
      return null;
    }
  
    if (microcapTier !== "HIGH") return null;
  
    const strong = illiquidTier === "HIGH";
  
    return toBadge({
      code: "HIGH_MICROCAP_EXPOSURE",
      label: "High Microcap Exposure",
      reason: strong
        ? "High microcap and illiquid exposure indicate elevated speculative risk."
        : "High microcap exposure indicates elevated speculative risk.",
      strength: strong ? "strong" : "soft",
      evidence: [
        signalEvidence("risk.microcapExposureTier"),
        signalEvidence("risk.illiquidExposureTier"),
        axisEvidence("axes.risk"),
      ],
    });
  }
  
  function buildConcentratedOperatorBadge(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
  ): IntelligenceBadgeV3 | null {
    if (axes.risk.status === "INSUFFICIENT" && axes.style.status === "INSUFFICIENT") {
      return null;
    }
  
    const concentration = extracted.signals.positions.concentrationIndex.value;
    const microcapTier = extracted.signals.risk.microcapExposureTier.value;
  
    if (!hasSupport(extracted, ["positions.concentrationIndex"], 1)) return null;
    if (concentration < 75) return null;
  
    const strong = microcapTier !== "LOW";
  
    return toBadge({
      code: "CONCENTRATED_OPERATOR",
      label: "Concentrated Operator",
      reason: strong
        ? "High concentration with supporting speculative exposure indicates concentrated risk-taking."
        : "High concentration indicates focused positioning.",
      strength: strong ? "strong" : "soft",
      evidence: [
        signalEvidence("positions.concentrationIndex"),
        signalEvidence("risk.microcapExposureTier"),
        axisEvidence("axes.risk"),
        axisEvidence("axes.style"),
      ],
    });
  }
  
  function hasSupport(
    extracted: ExtractedBehavioralSignalsV3,
    paths: readonly SignalPath[],
    minSupported: number,
  ): boolean {
    const supported = paths.filter((path) => extracted.support[path] !== "UNAVAILABLE").length;
    return supported >= minSupported;
  }
  
  function signalEvidence(sourcePath: SignalPath): {
    sourceType: "signal";
    sourcePath: string;
  } {
    return {
      sourceType: "signal",
      sourcePath,
    };
  }
  
  function axisEvidence(sourcePath: "axes.style" | "axes.risk"): {
    sourceType: "axis";
    sourcePath: string;
  } {
    return {
      sourceType: "axis",
      sourcePath,
    };
  }
  
  function toBadge(candidate: BadgeCandidate): IntelligenceBadgeV3 {
    return {
      code: candidate.code,
      label: candidate.label,
      reason: candidate.reason,
      strength: candidate.strength,
      evidence: candidate.evidence,
    };
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