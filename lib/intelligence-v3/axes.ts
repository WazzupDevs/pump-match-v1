import type {
    BehavioralAxes,
    CoverageTier,
    AxisStatus,
    AxisComponentScore,
    StyleAxis,
    QualityAxis,
    RiskAxis,
    AdaptationAxis,
    CredibilityAxis,
  } from "@/types/intelligence-report-v3";
  import type {
    ExtractedBehavioralSignalsV3,
    SignalPath,
  } from "./signals";
  import {
    axisStatusFromSupportRatio,
    clamp0to100,
    coverageTierFromPercent,
    weightedSupportRatio,
  } from "./normalize";
  
  type AxisName = "style" | "quality" | "risk" | "adaptation" | "credibility";
  
  type AxisComputationResult = {
    axes: BehavioralAxes;
    axisReliability: Record<AxisName, CoverageTier>;
  };
  
  export function computeBehavioralAxesV3(
    extracted: ExtractedBehavioralSignalsV3,
  ): AxisComputationResult {
    const style = computeStyleAxisV3(extracted);
    const quality = computeQualityAxisV3(extracted);
    const risk = computeRiskAxisV3(extracted);
    const adaptation = computeAdaptationAxisV3(extracted, quality.overall);
    const credibility = computeCredibilityAxisV3(extracted);
  
    const axes: BehavioralAxes = {
      style,
      quality,
      risk,
      adaptation,
      credibility,
    };
  
    const axisReliability: Record<AxisName, CoverageTier> = {
      style: coverageTierFromAxis(style.status, extracted, "style"),
      quality: coverageTierFromAxis(quality.status, extracted, "quality"),
      risk: coverageTierFromAxis(risk.status, extracted, "risk"),
      adaptation: coverageTierFromAxis(adaptation.status, extracted, "adaptation"),
      credibility: coverageTierFromAxis(credibility.status, extracted, "credibility"),
    };
  
    return {
      axes,
      axisReliability,
    };
  }
  
  export function computeStyleAxisV3(
    extracted: ExtractedBehavioralSignalsV3,
  ): StyleAxis {
    const { signals } = extracted;
  
    const tempoScore = txTempoToScore(signals.activity.txTempo.value);
    const burstScore = signals.activity.sessionBurstiness.value;
    const holdShortnessScore = holdTierToShortnessScore(
      signals.positions.medianHoldDurationTier.value,
    );
    const holdLongnessScore = holdTierToLongnessScore(
      signals.positions.medianHoldDurationTier.value,
    );
    const flipScore = signals.positions.fastFlipRatio.value;
    const churnScore = signals.rotation.tokenChurnRate.value;
    const momentumScore = threeTierToScore(
      signals.marketPosture.momentumParticipation.value,
    );
    const breakoutScore = threeTierToScore(
      signals.marketPosture.breakoutChaseTendency.value,
    );
    const concentrationScore = signals.positions.concentrationIndex.value;
    const reEntryScore = reEntryPatternToScore(
      signals.rotation.reEntryPattern.value,
    );
    const narrativeSwitchScore = threeTierToScore(
      signals.rotation.narrativeSwitchRate.value,
    );
    const speculationBiasScore = speculationBiasToScore(
      signals.protocol.stakingVsSpeculationBias.value,
    );
  
    const conviction = clamp0to100(
      concentrationScore * 0.36 +
        holdLongnessScore * 0.28 +
        invertScore(churnScore) * 0.20 +
        invertScore(flipScore) * 0.16,
    );
  
    const rotation = clamp0to100(
      churnScore * 0.34 +
        holdShortnessScore * 0.22 +
        reEntryScore * 0.22 +
        narrativeSwitchScore * 0.22,
    );
  
    const momentum = clamp0to100(
      momentumScore * 0.42 +
        breakoutScore * 0.30 +
        flipScore * 0.16 +
        tempoScore * 0.12,
    );
  
    const patience = clamp0to100(
      holdLongnessScore * 0.42 +
        invertScore(burstScore) * 0.20 +
        invertScore(flipScore) * 0.20 +
        invertScore(churnScore) * 0.18,
    );
  
    const opportunism = clamp0to100(
      burstScore * 0.24 +
        breakoutScore * 0.24 +
        narrativeSwitchScore * 0.20 +
        reEntryScore * 0.16 +
        holdShortnessScore * 0.16,
    );
  
    const overall = clamp0to100(
      (conviction + rotation + momentum + patience + opportunism) / 5,
    );
  
    const components: readonly AxisComponentScore[] = [
      { key: "tempo", value: tempoScore },
      { key: "burstiness", value: burstScore },
      { key: "holdShortness", value: holdShortnessScore },
      { key: "fastFlip", value: flipScore },
      { key: "tokenChurn", value: churnScore },
      { key: "momentumParticipation", value: momentumScore },
      { key: "breakoutChase", value: breakoutScore },
      { key: "concentration", value: concentrationScore },
      { key: "reEntry", value: reEntryScore },
      { key: "narrativeSwitch", value: narrativeSwitchScore },
      { key: "speculationBias", value: speculationBiasScore },
    ];
  
    const status = computeAxisStatus(
      extracted,
      [
        "activity.txTempo",
        "activity.sessionBurstiness",
        "positions.medianHoldDurationTier",
        "positions.fastFlipRatio",
        "positions.concentrationIndex",
        "rotation.tokenChurnRate",
        "rotation.reEntryPattern",
        "rotation.narrativeSwitchRate",
        "marketPosture.momentumParticipation",
        "marketPosture.breakoutChaseTendency",
        "protocol.stakingVsSpeculationBias",
      ],
      extracted.coverageBasis.txSampleSize <= 0,
    );
  
    return {
      overall,
      status,
      components,
      dimensions: {
        conviction,
        rotation,
        momentum,
        patience,
        opportunism,
      },
    };
  }
  
  export function computeQualityAxisV3(
    extracted: ExtractedBehavioralSignalsV3,
  ): QualityAxis {
    const { signals } = extracted;
  
    const consistencyFromActiveDays = signals.activity.activeDaysRatio.value;
    const stabilityFromBurstiness = invertScore(signals.activity.sessionBurstiness.value);
    const disciplineFromHoldPattern = holdTierToDisciplineScore(
      signals.positions.medianHoldDurationTier.value,
    );
    const penaltyInvertedFlipRatio = invertScore(signals.positions.fastFlipRatio.value);
    const concentrationDiscipline = concentrationToDisciplineScore(
      signals.positions.concentrationIndex.value,
    );
    const reEntryCoherence = reEntryPatternToCoherenceScore(
      signals.rotation.reEntryPattern.value,
    );
    const penaltyInvertedIlliquidExposure = invertScore(
      threeTierToScore(signals.risk.illiquidExposureTier.value),
    );
    const dipBuyRepeatability = threeTierToScore(
      signals.marketPosture.dipBuyConsistency.value,
    );
    const dexPreferenceConsistency = threeTierToScore(
      signals.protocol.dexPreferenceConsistency.value,
    );
  
    const overall = clamp0to100(
      consistencyFromActiveDays * 0.18 +
        stabilityFromBurstiness * 0.14 +
        disciplineFromHoldPattern * 0.16 +
        penaltyInvertedFlipRatio * 0.14 +
        concentrationDiscipline * 0.10 +
        reEntryCoherence * 0.10 +
        penaltyInvertedIlliquidExposure * 0.10 +
        dipBuyRepeatability * 0.08 +
        dexPreferenceConsistency * 0.08,
    );
  
    const components: readonly AxisComponentScore[] = [
      { key: "activeDaysConsistency", value: consistencyFromActiveDays },
      { key: "burstStability", value: stabilityFromBurstiness },
      { key: "holdDiscipline", value: disciplineFromHoldPattern },
      { key: "flipDiscipline", value: penaltyInvertedFlipRatio },
      { key: "concentrationDiscipline", value: concentrationDiscipline },
      { key: "reEntryCoherence", value: reEntryCoherence },
      { key: "illiquidityPenaltyInverted", value: penaltyInvertedIlliquidExposure },
      { key: "dipBuyRepeatability", value: dipBuyRepeatability },
      { key: "dexPreferenceConsistency", value: dexPreferenceConsistency },
    ];
  
    const status = computeAxisStatus(
      extracted,
      [
        "activity.activeDaysRatio",
        "activity.sessionBurstiness",
        "positions.medianHoldDurationTier",
        "positions.fastFlipRatio",
        "positions.concentrationIndex",
        "rotation.reEntryPattern",
        "risk.illiquidExposureTier",
        "marketPosture.dipBuyConsistency",
        "protocol.dexPreferenceConsistency",
      ],
      extracted.coverageBasis.txSampleSize <= 0,
    );
  
    return {
      overall,
      status,
      components,
    };
  }
  
  export function computeRiskAxisV3(
    extracted: ExtractedBehavioralSignalsV3,
  ): RiskAxis {
    const { signals } = extracted;
  
    const concentrationRisk = signals.positions.concentrationIndex.value;
    const microcapRisk = threeTierToScore(signals.risk.microcapExposureTier.value);
    const illiquidityRisk = threeTierToScore(signals.risk.illiquidExposureTier.value);
    const panicExitRisk = threeTierToScore(signals.risk.panicExitPattern.value);
    const flipRisk = signals.positions.fastFlipRatio.value;
    const breakoutChaseRisk = threeTierToScore(
      signals.marketPosture.breakoutChaseTendency.value,
    );
    const momentumHeatRisk = threeTierToScore(
      signals.marketPosture.momentumParticipation.value,
    );
  
    const overall = clamp0to100(
      concentrationRisk * 0.22 +
        microcapRisk * 0.22 +
        illiquidityRisk * 0.18 +
        panicExitRisk * 0.14 +
        flipRisk * 0.10 +
        breakoutChaseRisk * 0.08 +
        momentumHeatRisk * 0.06,
    );
  
    const components: readonly AxisComponentScore[] = [
      { key: "concentrationRisk", value: concentrationRisk },
      { key: "microcapRisk", value: microcapRisk },
      { key: "illiquidityRisk", value: illiquidityRisk },
      { key: "panicExitRisk", value: panicExitRisk },
      { key: "flipRisk", value: flipRisk },
      { key: "breakoutChaseRisk", value: breakoutChaseRisk },
      { key: "momentumHeatRisk", value: momentumHeatRisk },
    ];
  
    const status = computeAxisStatus(
      extracted,
      [
        "positions.concentrationIndex",
        "risk.microcapExposureTier",
        "risk.illiquidExposureTier",
        "risk.panicExitPattern",
        "positions.fastFlipRatio",
        "marketPosture.breakoutChaseTendency",
        "marketPosture.momentumParticipation",
      ],
      extracted.coverageBasis.txSampleSize <= 0,
    );
  
    return {
      overall,
      status,
      components,
    };
  }
  
  export function computeAdaptationAxisV3(
    extracted: ExtractedBehavioralSignalsV3,
    qualityOverall: number,
  ): AdaptationAxis {
    const { signals } = extracted;
  
    const narrativeSwitchScore = threeTierToScore(
      signals.rotation.narrativeSwitchRate.value,
    );
    const reEntryFlexibility = reEntryPatternToScore(
      signals.rotation.reEntryPattern.value,
    );
    const churnMobility = signals.rotation.tokenChurnRate.value;
    const dipBuyRegimeResponse = threeTierToScore(
      signals.marketPosture.dipBuyConsistency.value,
    );
    const momentumRegimeAlignment = threeTierToScore(
      signals.marketPosture.momentumParticipation.value,
    );
    const bridgeMobility = bridgeUsageToScore(
      signals.protocol.bridgeUsagePattern.value,
    );
  
    let overall = clamp0to100(
      narrativeSwitchScore * 0.24 +
        reEntryFlexibility * 0.20 +
        churnMobility * 0.18 +
        dipBuyRegimeResponse * 0.16 +
        momentumRegimeAlignment * 0.12 +
        bridgeMobility * 0.10,
    );
  
    if (narrativeSwitchScore > 85 && qualityOverall < 35) {
      overall = clamp0to100(overall - 10);
    }
  
    const components: readonly AxisComponentScore[] = [
      { key: "narrativeSwitch", value: narrativeSwitchScore },
      { key: "reEntryFlexibility", value: reEntryFlexibility },
      { key: "churnMobility", value: churnMobility },
      { key: "dipBuyRegimeResponse", value: dipBuyRegimeResponse },
      { key: "momentumRegimeAlignment", value: momentumRegimeAlignment },
      { key: "bridgeMobility", value: bridgeMobility },
    ];
  
    const status = computeAxisStatus(
      extracted,
      [
        "rotation.tokenChurnRate",
        "rotation.reEntryPattern",
        "rotation.narrativeSwitchRate",
        "marketPosture.momentumParticipation",
        "marketPosture.dipBuyConsistency",
        "protocol.bridgeUsagePattern",
      ],
      extracted.coverageBasis.txSampleSize <= 0,
    );
  
    return {
      overall,
      status,
      components,
    };
  }
  
  export function computeCredibilityAxisV3(
    extracted: ExtractedBehavioralSignalsV3,
  ): CredibilityAxis {
    const activeDaysCoverage = extracted.signals.activity.activeDaysRatio.value;
    const sessionDepth = txTempoToScore(extracted.signals.activity.txTempo.value);
    const closedPositionSufficiency = positionsSampledToScore(
      extracted.coverageBasis.positionsSampled,
    );
    const repeatabilityScore = clamp0to100(
      activeDaysCoverage * 0.55 + sessionDepth * 0.45,
    );
    const familyCompletenessScore = extracted.coverageBasis.familyCompleteness;
  
    const hardInsufficient =
      extracted.coverageBasis.activeDaysObserved < 5 ||
      extracted.coverageBasis.positionsSampled < 3 ||
      extracted.coverageBasis.familyCompleteness < 25;
  
    const overall = clamp0to100(
      activeDaysCoverage * 0.28 +
        sessionDepth * 0.18 +
        closedPositionSufficiency * 0.18 +
        repeatabilityScore * 0.18 +
        familyCompletenessScore * 0.18,
    );
  
    const components: readonly AxisComponentScore[] = [
      { key: "activeDaysCoverage", value: activeDaysCoverage },
      { key: "sessionDepth", value: sessionDepth },
      { key: "closedPositionSufficiency", value: closedPositionSufficiency },
      { key: "repeatability", value: repeatabilityScore },
      { key: "familyCompleteness", value: familyCompletenessScore },
    ];
  
    const status = computeAxisStatus(
      extracted,
      [
        "activity.activeDaysRatio",
        "activity.txTempo",
        "positions.medianHoldDurationTier",
        "positions.fastFlipRatio",
        "rotation.tokenChurnRate",
        "marketPosture.momentumParticipation",
      ],
      hardInsufficient,
    );
  
    return {
      overall,
      status,
      components,
    };
  }
  
  function computeAxisStatus(
    extracted: ExtractedBehavioralSignalsV3,
    signalPaths: readonly SignalPath[],
    hardInsufficient: boolean,
  ): AxisStatus {
    const supports = signalPaths.map((path) => extracted.support[path]);
    const { weighted, measuredFraction } = weightedSupportRatio(supports);

    return axisStatusFromSupportRatio(weighted, measuredFraction, hardInsufficient);
  }
  
  function coverageTierFromAxis(
    status: AxisStatus,
    extracted: ExtractedBehavioralSignalsV3,
    axis: AxisName,
  ): CoverageTier {
    if (status === "INSUFFICIENT") return "LOW";
  
    switch (axis) {
      case "style":
        return tierFromSignalPaths(extracted, [
          "activity.txTempo",
          "positions.medianHoldDurationTier",
          "positions.fastFlipRatio",
          "rotation.tokenChurnRate",
          "marketPosture.momentumParticipation",
        ]);
      case "quality":
        return tierFromSignalPaths(extracted, [
          "activity.activeDaysRatio",
          "positions.medianHoldDurationTier",
          "positions.fastFlipRatio",
          "positions.concentrationIndex",
        ]);
      case "risk":
        return tierFromSignalPaths(extracted, [
          "positions.concentrationIndex",
          "risk.microcapExposureTier",
          "risk.illiquidExposureTier",
          "marketPosture.breakoutChaseTendency",
        ]);
      case "adaptation":
        return tierFromSignalPaths(extracted, [
          "rotation.tokenChurnRate",
          "rotation.narrativeSwitchRate",
          "marketPosture.momentumParticipation",
        ]);
      case "credibility":
        return tierFromSignalPaths(extracted, [
          "activity.activeDaysRatio",
          "activity.txTempo",
          "positions.medianHoldDurationTier",
        ]);
    }
  }
  
  function tierFromSignalPaths(
    extracted: ExtractedBehavioralSignalsV3,
    signalPaths: readonly SignalPath[],
  ): CoverageTier {
    const supports = signalPaths.map((path) => extracted.support[path]);
    const { weighted } = weightedSupportRatio(supports);

    return coverageTierFromPercent(weighted * 100);
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
  
  function txTempoToScore(value: "LOW" | "MEDIUM" | "HIGH"): number {
    return threeTierToScore(value);
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
  
  function holdTierToDisciplineScore(
    value: "VERY_SHORT" | "SHORT" | "MEDIUM" | "LONG",
  ): number {
    switch (value) {
      case "VERY_SHORT":
        return 25;
      case "SHORT":
        return 45;
      case "MEDIUM":
        return 70;
      case "LONG":
        return 78;
    }
  }
  
  function reEntryPatternToScore(
    value: "RARE" | "OCCASIONAL" | "FREQUENT",
  ): number {
    switch (value) {
      case "RARE":
        return 20;
      case "OCCASIONAL":
        return 50;
      case "FREQUENT":
        return 80;
    }
  }
  
  function reEntryPatternToCoherenceScore(
    value: "RARE" | "OCCASIONAL" | "FREQUENT",
  ): number {
    switch (value) {
      case "RARE":
        return 45;
      case "OCCASIONAL":
        return 70;
      case "FREQUENT":
        return 52;
    }
  }
  
  function bridgeUsageToScore(
    value: "NONE" | "OCCASIONAL" | "FREQUENT",
  ): number {
    switch (value) {
      case "NONE":
        return 10;
      case "OCCASIONAL":
        return 45;
      case "FREQUENT":
        return 75;
    }
  }
  
  function speculationBiasToScore(
    value: "STAKING_LEANING" | "BALANCED" | "SPECULATION_LEANING",
  ): number {
    switch (value) {
      case "STAKING_LEANING":
        return 20;
      case "BALANCED":
        return 50;
      case "SPECULATION_LEANING":
        return 80;
    }
  }
  
  function concentrationToDisciplineScore(value: number): number {
    if (value <= 35) return 72;
    if (value <= 70) return 60;
    return 42;
  }
  
  function positionsSampledToScore(positionsSampled: number): number {
    if (positionsSampled >= 20) return 90;
    if (positionsSampled >= 10) return 75;
    if (positionsSampled >= 5) return 55;
    if (positionsSampled >= 3) return 35;
    return 15;
  }
  
  function invertScore(value: number): number {
    return clamp0to100(100 - clamp0to100(value));
  }