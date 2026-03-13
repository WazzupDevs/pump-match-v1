import type {
    BehavioralAxes,
    PrimaryStyleClassification,
    PrimaryStyleLabel,
  } from "@/types/intelligence-report-v3";
  import type { ExtractedBehavioralSignalsV3 } from "./signals";
  import { clamp0to100 } from "./normalize";
  
  type CandidateKey =
    | "convictionLed"
    | "rotationLed"
    | "momentumReactive"
    | "opportunistic"
    | "passiveAllocator";
  
  type CandidateScores = Record<CandidateKey, number>;
  
  const WINNER_MARGIN_THRESHOLD = 12;
  
  export function computePrimaryStyleClassificationV3(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
  ): PrimaryStyleClassification {
    const candidates = computePrimaryStyleCandidates(extracted, axes);
    const winner = selectPrimaryStyleLabel(candidates, extracted, axes);
    // Insufficient-data wallets always receive confidence 0 — no behavioral basis to score.
    const confidence = winner === "INSUFFICIENT_DATA"
      ? 0
      : computePrimaryStyleConfidence(candidates, axes);
    const explanation = buildPrimaryStyleExplanation(winner, axes, confidence);
  
    return {
      label: winner,
      confidence,
      affinities: candidates,
      explanation,
    };
  }
  
  export function computePrimaryStyleCandidates(
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
  ): CandidateScores {
    const activeDaysRatio = extracted.signals.activity.activeDaysRatio.value;
    const tempoScore = txTempoToScore(extracted.signals.activity.txTempo.value);
    const burstScore = extracted.signals.activity.sessionBurstiness.value;
  
    const holdShortBias = holdTierToShortnessScore(
      extracted.signals.positions.medianHoldDurationTier.value,
    );
    const holdLongBias = holdTierToLongnessScore(
      extracted.signals.positions.medianHoldDurationTier.value,
    );
    const flipScore = extracted.signals.positions.fastFlipRatio.value;
    const concentrationScore = extracted.signals.positions.concentrationIndex.value;
  
    const churnScore = extracted.signals.rotation.tokenChurnRate.value;
    const reEntryFrequency = reEntryPatternToScore(
      extracted.signals.rotation.reEntryPattern.value,
    );
    const narrativeSwitchScore = threeTierToScore(
      extracted.signals.rotation.narrativeSwitchRate.value,
    );
  
    const momentumScore = threeTierToScore(
      extracted.signals.marketPosture.momentumParticipation.value,
    );
    const breakoutScore = threeTierToScore(
      extracted.signals.marketPosture.breakoutChaseTendency.value,
    );
  
    const stakingBias = stakingBiasToPassiveScore(
      extracted.signals.protocol.stakingVsSpeculationBias.value,
    );
  
    const convictionCandidate = clamp0to100(
      concentrationScore * 0.32 +
        holdLongBias * 0.26 +
        invertScore(churnScore) * 0.18 +
        invertScore(flipScore) * 0.14 +
        activeDaysRatio * 0.10,
    );
  
    // reEntryFrequency is now lifecycle-derived (RARE/OCCASIONAL/FREQUENT are real).
    // Weight it higher in rotation: re-entry = cycling through same tokens.
    const rotationCandidate = clamp0to100(
      churnScore * 0.32 +
        holdShortBias * 0.22 +
        narrativeSwitchScore * 0.18 +
        reEntryFrequency * 0.18 +    // was 0.10 — now real, strong rotation signal
        tempoScore * 0.10,           // was 0.14 — tempo is weaker rotation indicator
    );

    const momentumRaw =
      momentumScore * 0.42 +
        breakoutScore * 0.30 +
        invertScore(churnScore) * 0.12 +
        flipScore * 0.08 +
        tempoScore * 0.08;
    // High churn suppresses momentum — generic hyperactivity ≠ momentum
    const churnSuppression = churnScore > 50 ? (churnScore - 50) * 0.30 : 0;
    // FREQUENT re-entry → cycling same tokens = rotation pattern, not momentum
    const reEntrySuppression = reEntryFrequency > 65 ? (reEntryFrequency - 65) * 0.20 : 0;
    const momentumCandidate = clamp0to100(momentumRaw - churnSuppression - reEntrySuppression);

    // Opportunistic is burst-driven and reactive, not re-entry-driven.
    // Reduce reEntryFrequency weight; redistribute to burst/tempo/narrative.
    const opportunisticCandidate = clamp0to100(
      burstScore * 0.26 +            // was 0.22
        breakoutScore * 0.20 +
        tempoScore * 0.18 +          // was 0.16
        narrativeSwitchScore * 0.18 + // was 0.16
        holdShortBias * 0.12 +       // was 0.14
        reEntryFrequency * 0.06,     // was 0.12 — re-entry favors rotation, not opportunism
    );
  
    const passiveAllocatorCandidate = clamp0to100(
      holdLongBias * 0.34 +
        invertScore(tempoScore) * 0.22 +
        invertScore(churnScore) * 0.18 +
        stakingBias * 0.16 +
        invertScore(burstScore) * 0.10,
    );
  
    // Blend candidate scores with the already-computed style axis dimensions
    // so the top-level label stays aligned with the axis family.
    return {
      convictionLed: clamp0to100(
        convictionCandidate * 0.65 + axes.style.dimensions.conviction * 0.35,
      ),
      rotationLed: clamp0to100(
        rotationCandidate * 0.65 + axes.style.dimensions.rotation * 0.35,
      ),
      momentumReactive: clamp0to100(
        momentumCandidate * 0.65 + axes.style.dimensions.momentum * 0.35,
      ),
      opportunistic: clamp0to100(
        opportunisticCandidate * 0.65 + axes.style.dimensions.opportunism * 0.35,
      ),
      passiveAllocator: clamp0to100(
        passiveAllocatorCandidate * 0.65 + axes.style.dimensions.patience * 0.35,
      ),
    };
  }
  
  function selectPrimaryStyleLabel(
    candidates: CandidateScores,
    extracted: ExtractedBehavioralSignalsV3,
    axes: BehavioralAxes,
  ): PrimaryStyleLabel {
    // Minimum-data guard: a wallet with hard-insufficient credibility AND no
    // closed positions AND effectively no transaction history has no behavioral
    // basis for any style label. Return INSUFFICIENT_DATA instead of inventing
    // a trader persona from default signal values.
    //
    // Thresholds (conservative):
    //   positionsSampled === 0  → generalClosedPositions == 0 AND pumpStats?.closedPositions == 0
    //   txSampleSize < 5        → core.transactionCount < 5 (almost no on-chain history)
    //   credibility INSUFFICIENT → activeDaysObserved < 5 OR positionsSampled < 3 OR familyCompleteness < 25
    //
    // DiCG (9 open meme tokens, 20+ spam txs) has txSampleSize >= 20 → NOT blocked.
    // FHv2 (0 SOL, 1 zero-balance token, ~1 tx) has txSampleSize < 5 → blocked.
    const hasNoLifecycleEvidence =
      axes.credibility.status === "INSUFFICIENT" &&
      extracted.coverageBasis.positionsSampled === 0 &&
      extracted.coverageBasis.txSampleSize < 5;

    if (hasNoLifecycleEvidence) {
      return "INSUFFICIENT_DATA";
    }

    const sorted = sortCandidates(candidates);
    const [top, second] = sorted;

    const credibilityLimited =
      axes.credibility.status === "INSUFFICIENT" ||
      axes.credibility.overall < 30;

    if (!credibilityLimited && top.score - second.score >= WINNER_MARGIN_THRESHOLD) {
      return candidateKeyToPrimaryStyleLabel(top.key);
    }

    return conservativeTieBreak(extracted);
  }
  
  function conservativeTieBreak(
    extracted: ExtractedBehavioralSignalsV3,
  ): PrimaryStyleLabel {
    const tempoScore = txTempoToScore(extracted.signals.activity.txTempo.value);
    const burstScore = extracted.signals.activity.sessionBurstiness.value;

    const holdShortBias = holdTierToShortnessScore(
      extracted.signals.positions.medianHoldDurationTier.value,
    );
    const holdLongBias = holdTierToLongnessScore(
      extracted.signals.positions.medianHoldDurationTier.value,
    );
    const concentrationScore = extracted.signals.positions.concentrationIndex.value;
    const churnScore = extracted.signals.rotation.tokenChurnRate.value;
    const reEntryFrequency = reEntryPatternToScore(
      extracted.signals.rotation.reEntryPattern.value,
    );

    const momentumScore = threeTierToScore(
      extracted.signals.marketPosture.momentumParticipation.value,
    );
    const breakoutScore = threeTierToScore(
      extracted.signals.marketPosture.breakoutChaseTendency.value,
    );

    if (concentrationScore >= 70 && holdLongBias >= 75 && churnScore <= 35) {
      return "CONVICTION_LED";
    }

    if (holdLongBias >= 75 && tempoScore <= 35 && churnScore <= 40 && burstScore <= 40) {
      return "PASSIVE_ALLOCATOR";
    }

    // Primary rotation path: short holds + elevated churn
    if (holdShortBias >= 70 && churnScore >= 55) {
      return "ROTATION_LED";
    }

    // Secondary rotation path: FREQUENT re-entry + moderate churn
    // Cycling through the same tokens is definitionally rotation, even without extreme churn.
    if (churnScore >= 50 && reEntryFrequency >= 70) {
      return "ROTATION_LED";
    }

    // Momentum requires clean momentum evidence AND low re-entry.
    // FREQUENT re-entry indicates cycling behavior, not momentum participation.
    if (momentumScore >= 67 && breakoutScore >= 67 && churnScore <= 45 && reEntryFrequency <= 60) {
      return "MOMENTUM_REACTIVE";
    }

    return "OPPORTUNISTIC";
  }
  
  function computePrimaryStyleConfidence(
    candidates: CandidateScores,
    axes: BehavioralAxes,
  ): number {
    const sorted = sortCandidates(candidates);
    const [top, second] = sorted;
  
    const winnerMargin = clamp0to100((top.score - second.score) * 6);
    let confidence = clamp0to100(
      top.score * 0.55 + winnerMargin * 0.25 + axes.credibility.overall * 0.20,
    );
  
    if (axes.credibility.status === "INSUFFICIENT") {
      confidence = Math.min(confidence, 40);
    } else if (axes.credibility.status === "ESTIMATED") {
      confidence = Math.min(confidence, 70);
    }
  
    return clamp0to100(confidence);
  }
  
  function buildPrimaryStyleExplanation(
    label: PrimaryStyleLabel,
    axes: BehavioralAxes,
    confidence: number,
  ): string {
    const confidenceQualifier =
      confidence >= 70
        ? "high-confidence"
        : confidence >= 40
          ? "moderate-confidence"
          : "low-confidence";
  
    switch (label) {
      case "CONVICTION_LED":
        return `Deterministic ${confidenceQualifier} classification driven by concentration, longer hold bias, and lower churn behavior.`;
      case "ROTATION_LED":
        return `Deterministic ${confidenceQualifier} classification driven by elevated churn, shorter hold behavior, and recurring rotation patterns.`;
      case "MOMENTUM_REACTIVE":
        return `Deterministic ${confidenceQualifier} classification driven by momentum participation, breakout-chasing tendency, and faster execution tempo.`;
      case "OPPORTUNISTIC":
        return `Deterministic ${confidenceQualifier} classification driven by bursty execution, reactive entries, and mixed adaptation patterns.`;
      case "PASSIVE_ALLOCATOR":
        return `Deterministic ${confidenceQualifier} classification driven by longer hold bias, lower execution tempo, and lower churn behavior.`;
      case "INSUFFICIENT_DATA":
        return "Insufficient on-chain behavioral evidence to determine a trading style. No closed positions and fewer than 5 transactions observed.";
    }
  }
  
  function sortCandidates(candidates: CandidateScores): Array<{
    key: CandidateKey;
    score: number;
  }> {
    return (Object.entries(candidates) as Array<[CandidateKey, number]>)
      .map(([key, score]) => ({ key, score }))
      .sort((a, b) => b.score - a.score);
  }
  
  function candidateKeyToPrimaryStyleLabel(key: CandidateKey): PrimaryStyleLabel {
    switch (key) {
      case "convictionLed":
        return "CONVICTION_LED";
      case "rotationLed":
        return "ROTATION_LED";
      case "momentumReactive":
        return "MOMENTUM_REACTIVE";
      case "opportunistic":
        return "OPPORTUNISTIC";
      case "passiveAllocator":
        return "PASSIVE_ALLOCATOR";
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
  
  function stakingBiasToPassiveScore(
    value: "STAKING_LEANING" | "BALANCED" | "SPECULATION_LEANING",
  ): number {
    switch (value) {
      case "STAKING_LEANING":
        return 80;
      case "BALANCED":
        return 50;
      case "SPECULATION_LEANING":
        return 20;
    }
  }
  
  function invertScore(value: number): number {
    return clamp0to100(100 - clamp0to100(value));
  }