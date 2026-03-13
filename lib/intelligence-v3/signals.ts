import type { OnchainCore } from "@/types/intelligence-core";
import type {
  BehavioralSignalFamilies,
  CoverageTier,
} from "@/types/intelligence-report-v3";
import {
  clamp0to100,
  concentrationFromTokenDiversity,
  enumSignal,
  holdDurationTierFromSeconds,
  invert100,
  numericSignal,
  ratioToPercent,
  safeDivide,
  scoreToBridgeUsagePattern,
  scoreToReEntryPattern,
  scoreToSpeculationBias,
  scoreToThreeTier,
  SignalSupport,
  SUPPORT_WEIGHT,
  tierSignal,
  txTempoFromTradesPerActiveDay,
} from "./normalize";

export type SignalPath =
  | "activity.activeDaysRatio"
  | "activity.txTempo"
  | "activity.sessionBurstiness"
  | "positions.medianHoldDurationTier"
  | "positions.fastFlipRatio"
  | "positions.concentrationIndex"
  | "rotation.tokenChurnRate"
  | "rotation.reEntryPattern"
  | "rotation.narrativeSwitchRate"
  | "risk.microcapExposureTier"
  | "risk.illiquidExposureTier"
  | "risk.panicExitPattern"
  | "marketPosture.momentumParticipation"
  | "marketPosture.dipBuyConsistency"
  | "marketPosture.breakoutChaseTendency"
  | "protocol.dexPreferenceConsistency"
  | "protocol.bridgeUsagePattern"
  | "protocol.stakingVsSpeculationBias";

export type ExtractedBehavioralSignalsV3 = {
  signals: BehavioralSignalFamilies;
  support: Record<SignalPath, SignalSupport>;
  coverageBasis: {
    txSampleSize: number;
    positionsSampled: number;
    activeDaysObserved: number;
    familyCompleteness: number;
    familyReliability: {
      activity: CoverageTier;
      positions: CoverageTier;
      rotation: CoverageTier;
      risk: CoverageTier;
      marketPosture: CoverageTier;
      protocol: CoverageTier;
    };
  };
};

export type SignalExtractionOptions = {
  observationWindowDays: number;
};

/**
 * IMPORTANT:
 * This extractor is intentionally conservative.
 *
 * The current repo's OnchainCore does NOT yet carry the full v3 behavioral basis
 * (sessions, distinct active days, re-entry events, sector switches, protocol mix).
 *
 * So this layer does two things:
 *   1. derives what it can deterministically from current fields
 *   2. marks weaker fields as PROXY or UNAVAILABLE via the support map
 *
 * Later patches can upgrade support from PROXY/UNAVAILABLE -> MEASURED
 * without breaking the contract.
 */
export function extractBehavioralSignalsV3(
  core: OnchainCore,
  options?: Partial<SignalExtractionOptions>,
): ExtractedBehavioralSignalsV3 {
  const observationWindowDays = Math.max(1, options?.observationWindowDays ?? 90);

  const activeDaysObserved = estimateActiveDaysObserved(core, observationWindowDays);
  const positionsSampled = core.generalClosedPositions ?? core.pumpStats?.closedPositions ?? 0;

  const activeDaysRatioValue = ratioToPercent(
    safeDivide(activeDaysObserved, observationWindowDays),
  );

  // Use directional tx count for tempo/burst — excludes LP/protocol mechanics from trading rate.
  // Falls back to raw transactionCount when directional data is unavailable.
  const directionalTxCount = core.generalDirectionalTxCount ?? core.transactionCount;
  const tradesPerActiveDay = safeDivide(directionalTxCount, Math.max(1, activeDaysObserved));
  const txTempoValue = txTempoFromTradesPerActiveDay(tradesPerActiveDay);

  const sessionBurstinessValue = estimateSessionBurstiness(core, tradesPerActiveDay);

  // Prefer general lifecycle hold time (all tokens) over pump.fun-only metric.
  // This gives a materially more accurate representation of actual trade durations.
  const bestHoldTimeSeconds =
    core.generalMedianHoldTimeSeconds ?? core.pumpStats?.medianHoldTimeSeconds ?? null;

  const medianHoldDurationTierValue = holdDurationTierFromSeconds(bestHoldTimeSeconds);

  // Prefer direct position-count ratio when closed positions are available.
  // Falls back to median-based heuristic when lifecycle data is thin.
  const fastFlipRatioValue = estimateFastFlipRatio(core, bestHoldTimeSeconds);

  const concentrationIndexValue = concentrationFromTokenDiversity(core.tokenDiversity);

  const tokenChurnRateValue = estimateTokenChurnRate(core);
  const reEntryPatternValue = scoreToReEntryPattern(estimateReEntryScore(core));
  const narrativeSwitchRateValue = scoreToThreeTier(
    estimateNarrativeSwitchRate(core),
  );

  const microcapExposureTierValue = scoreToThreeTier(50); // unavailable -> neutral
  const illiquidExposureTierValue = scoreToThreeTier(50); // unavailable -> neutral
  const panicExitPatternValue = scoreToThreeTier(50); // unavailable -> neutral

  const momentumParticipationValue = scoreToThreeTier(
    estimateMomentumParticipation(core),
  );
  const dipBuyConsistencyValue = scoreToThreeTier(50); // unavailable -> neutral
  const breakoutChaseTendencyValue = scoreToThreeTier(
    estimateBreakoutChaseTendency(core),
  );

  const dexPreferenceConsistencyValue = scoreToThreeTier(50); // unavailable -> neutral
  const bridgeUsagePatternValue = scoreToBridgeUsagePattern(0); // unavailable -> NONE
  const stakingVsSpeculationBiasValue = scoreToSpeculationBias(
    estimateSpeculationBias(core),
  );

  const signals: BehavioralSignalFamilies = {
    activity: {
      activeDaysRatio: numericSignal(activeDaysRatioValue, true),
      txTempo: tierSignal(txTempoValue, true),
      sessionBurstiness: numericSignal(sessionBurstinessValue, true),
    },
    positions: {
      medianHoldDurationTier: enumSignal(medianHoldDurationTierValue, true),
      fastFlipRatio: numericSignal(fastFlipRatioValue, true),
      concentrationIndex: numericSignal(concentrationIndexValue, true),
    },
    rotation: {
      tokenChurnRate: numericSignal(tokenChurnRateValue, true),
      reEntryPattern: enumSignal(reEntryPatternValue, true),
      narrativeSwitchRate: tierSignal(narrativeSwitchRateValue, true),
    },
    risk: {
      microcapExposureTier: enumSignal(microcapExposureTierValue, true),
      illiquidExposureTier: enumSignal(illiquidExposureTierValue, true),
      panicExitPattern: tierSignal(panicExitPatternValue, false),
    },
    marketPosture: {
      momentumParticipation: tierSignal(momentumParticipationValue, true),
      dipBuyConsistency: tierSignal(dipBuyConsistencyValue, false),
      breakoutChaseTendency: tierSignal(breakoutChaseTendencyValue, true),
    },
    protocol: {
      dexPreferenceConsistency: tierSignal(dexPreferenceConsistencyValue, false),
      bridgeUsagePattern: enumSignal(bridgeUsagePatternValue, false),
      stakingVsSpeculationBias: enumSignal(stakingVsSpeculationBiasValue, false),
    },
  };

  const support: Record<SignalPath, SignalSupport> = {
    "activity.activeDaysRatio": activeDaysObserved > 0 ? "PROXY" : "UNAVAILABLE",
    "activity.txTempo": core.transactionCount > 0 ? "PROXY" : "UNAVAILABLE",
    "activity.sessionBurstiness": core.transactionCount > 0 ? "PROXY" : "UNAVAILABLE",

    "positions.medianHoldDurationTier":
      bestHoldTimeSeconds != null ? "PROXY" : "UNAVAILABLE",
    "positions.fastFlipRatio":
      (core.generalFastCloseCount != null || bestHoldTimeSeconds != null) ? "PROXY" : "UNAVAILABLE",
    "positions.concentrationIndex": core.totalAssets > 0 ? "PROXY" : "UNAVAILABLE",

    "rotation.tokenChurnRate":
      (core.generalUniqueMintsTraded != null || core.transactionCount > 0 || core.tokenDiversity > 0) ? "PROXY" : "UNAVAILABLE",
    "rotation.reEntryPattern":
      core.generalReEntryCount != null ? "PROXY" : "UNAVAILABLE",
    "rotation.narrativeSwitchRate":
      (core.generalUniqueMintsTraded != null || core.tokenDiversity > 0) ? "PROXY" : "UNAVAILABLE",

    "risk.microcapExposureTier": "UNAVAILABLE",
    "risk.illiquidExposureTier": "UNAVAILABLE",
    "risk.panicExitPattern": "UNAVAILABLE",

    "marketPosture.momentumParticipation":
      bestHoldTimeSeconds != null || core.transactionCount > 0 ? "PROXY" : "UNAVAILABLE",
    "marketPosture.dipBuyConsistency": "UNAVAILABLE",
    "marketPosture.breakoutChaseTendency":
      bestHoldTimeSeconds != null || core.transactionCount > 0 ? "PROXY" : "UNAVAILABLE",

    "protocol.dexPreferenceConsistency": "UNAVAILABLE",
    "protocol.bridgeUsagePattern": "UNAVAILABLE",
    "protocol.stakingVsSpeculationBias":
      (core.pumpStats?.pumpMintsTouched != null || (core.generalClosedPositions ?? 0) > 0)
        ? "PROXY"
        : "UNAVAILABLE",
  };

  const familyReliability = {
    activity: familyTierFromSupport(support, "activity"),
    positions: familyTierFromSupport(support, "positions"),
    rotation: familyTierFromSupport(support, "rotation"),
    risk: familyTierFromSupport(support, "risk"),
    marketPosture: familyTierFromSupport(support, "marketPosture"),
    protocol: familyTierFromSupport(support, "protocol"),
  };

  const supportedSignalCount = Object.values(support).filter((value) => value !== "UNAVAILABLE").length;
  const totalSignalCount = Object.keys(support).length;
  const familyCompleteness = clamp0to100((supportedSignalCount / totalSignalCount) * 100);

  return {
    signals,
    support,
    coverageBasis: {
      txSampleSize: core.transactionCount,
      positionsSampled,
      activeDaysObserved,
      familyCompleteness,
      familyReliability,
    },
  };
}

function estimateActiveDaysObserved(
  core: OnchainCore,
  observationWindowDays: number,
): number {
  if (core.transactionCount <= 0) return 0;

  // Conservative temporary proxy:
  // assume ~8 transactions can fit into one "active day" on average.
  // This is explicitly a proxy until tx-day histogram is added to OnchainCore.
  const proxyFromTransactions = Math.max(1, Math.round(core.transactionCount / 8));

  if (core.approxWalletAgeDays != null && core.approxWalletAgeDays > 0) {
    return Math.min(
      observationWindowDays,
      Math.min(Math.round(core.approxWalletAgeDays), proxyFromTransactions),
    );
  }

  return Math.min(observationWindowDays, proxyFromTransactions);
}

function estimateSessionBurstiness(
  core: OnchainCore,
  tradesPerActiveDay: number,
): number {
  if (core.transactionCount <= 0) return 0;

  // Temporary proxy:
  // higher trades/day with lower diversity tends to imply more clustered bursts.
  // Coefficient reduced (10 → 6) so saturation requires ~17 trades/day instead of 10.
  const diversityDampener = invert100(concentrationFromTokenDiversity(core.tokenDiversity));
  return clamp0to100(tradesPerActiveDay * 6 + diversityDampener * 0.25);
}

function estimateFastFlipRatioFromHoldTime(
  medianHoldTimeSeconds: number | null | undefined,
): number {
  if (!medianHoldTimeSeconds || medianHoldTimeSeconds <= 0) return 50;

  // More gradual scale to reduce saturation for the broad < 1h bucket.
  if (medianHoldTimeSeconds < 10 * 60) return 88;       // < 10min: extreme flipper
  if (medianHoldTimeSeconds < 60 * 60) return 70;        // < 1h: fast but not extreme
  if (medianHoldTimeSeconds < 24 * 60 * 60) return 48;   // < 1d: moderate
  if (medianHoldTimeSeconds < 7 * 24 * 60 * 60) return 28; // < 7d: patient-ish
  return 12;
}

function estimateFastFlipRatio(core: OnchainCore, bestHoldTimeSeconds: number | null): number {
  const closedPositions = core.generalClosedPositions ?? 0;
  const fastCloseCount = core.generalFastCloseCount ?? 0;
  // When we have enough closed positions, use the direct measured ratio.
  if (closedPositions >= 3) {
    return clamp0to100((fastCloseCount / closedPositions) * 100);
  }
  // Fallback: heuristic from median hold time
  return estimateFastFlipRatioFromHoldTime(bestHoldTimeSeconds);
}

function estimateReEntryScore(core: OnchainCore): number {
  const reEntryCount = core.generalReEntryCount;
  const closedPositions = core.generalClosedPositions ?? 0;
  // Need at least 3 closed positions for a meaningful re-entry ratio.
  if (reEntryCount == null || closedPositions < 3) return 50; // neutral
  const reEntryRatio = Math.min(1, reEntryCount / closedPositions);
  return clamp0to100(reEntryRatio * 100);
}

function estimateTokenChurnRate(core: OnchainCore): number {
  if (core.transactionCount <= 0) return 0;
  const directionalTxCount = core.generalDirectionalTxCount ?? core.transactionCount;
  const txComponent = clamp0to100(directionalTxCount / 6);
  // Breadth basis preference order (most to least semantically correct):
  // 1. generalExitedUniqueMintsTraded — unique mints with ≥1 confirmed closed cycle.
  //    Immune to airdrop inflation (no exit event ⇒ not counted) AND to same-token repeat
  //    cycles (a mint that was traded 20 times still contributes breadth = 1).
  // 2. generalClosedPositions — cycle count; no airdrop inflation but overcounts repeat traders.
  // 3. generalUniqueMintsTraded — entry OR exit breadth; contaminated by airdrop receipts.
  // 4. tokenDiversity — current holdings; contaminated by junk/reward inventory.
  const exitedUniqueMints = core.generalExitedUniqueMintsTraded ?? 0;
  const closedPositions = core.generalClosedPositions ?? 0;
  const mintBasis = exitedUniqueMints > 0
    ? exitedUniqueMints
    : closedPositions > 0
      ? closedPositions
      : (core.generalUniqueMintsTraded ?? core.tokenDiversity);
  const mintComponent = clamp0to100(mintBasis * 8);
  return clamp0to100(mintComponent * 0.55 + txComponent * 0.45);
}

function estimateNarrativeSwitchRate(core: OnchainCore): number {
  const directionalTxCount = core.generalDirectionalTxCount ?? core.transactionCount;
  const activityComponent = clamp0to100(directionalTxCount / 8);
  // Same breadth basis preference as tokenChurnRate.
  // Narrative switching specifically requires completing the exit: merely entering a new token
  // (airdrop receipt or idle open position) does not constitute a narrative switch.
  // Same-token repeat cycles count once — rapidly trading the same mint is not narrative rotation.
  const exitedUniqueMints = core.generalExitedUniqueMintsTraded ?? 0;
  const closedPositions = core.generalClosedPositions ?? 0;
  const mintBasis = exitedUniqueMints > 0
    ? exitedUniqueMints
    : closedPositions > 0
      ? closedPositions
      : (core.generalUniqueMintsTraded ?? core.tokenDiversity);
  const diversityComponent = clamp0to100(mintBasis * 8);
  return clamp0to100(diversityComponent * 0.6 + activityComponent * 0.4);
}

function estimateMomentumParticipation(core: OnchainCore): number {
  // Temporary proxy: reduced holdScore weight (0.55 → 0.35) and added activity reactivity
  // to decouple momentum from the shared fastFlip proxy.
  const holdScore = estimateFastFlipRatioFromHoldTime(
    core.generalMedianHoldTimeSeconds ?? core.pumpStats?.medianHoldTimeSeconds,
  );
  const directionalTxCount = core.generalDirectionalTxCount ?? core.transactionCount;
  const txComponent = clamp0to100(directionalTxCount / 10);
  // activityReactivity uses directional count only — LP/protocol mechanics are not trading reactivity.
  const activityReactivity = clamp0to100(directionalTxCount / 25);
  return clamp0to100(holdScore * 0.35 + txComponent * 0.30 + activityReactivity * 0.35);
}

function estimateBreakoutChaseTendency(core: OnchainCore): number {
  // Temporary proxy: reduced holdScore weight (0.65 → 0.50) so activity count
  // matters more — breakout chasing should require high on-chain reactivity, not just short holds.
  const holdScore = estimateFastFlipRatioFromHoldTime(
    core.generalMedianHoldTimeSeconds ?? core.pumpStats?.medianHoldTimeSeconds,
  );
  // Use directional tx count — breakout chasing requires actual directional trade reactivity,
  // not LP pool operations or protocol mechanics.
  const directionalTxCount = core.generalDirectionalTxCount ?? core.transactionCount;
  const activityComponent = clamp0to100(directionalTxCount / 20);
  return clamp0to100(holdScore * 0.50 + activityComponent * 0.50);
}

function estimateSpeculationBias(core: OnchainCore): number {
  if (core.pumpStats && core.pumpStats.pumpMintsTouched > 0) {
    return clamp0to100(
      core.pumpStats.pumpMintsTouched * 6 +
        core.pumpStats.closedPositions * 2,
    );
  }
  // General fallback: use closed positions as speculation activity proxy.
  // No mint-count amplifier — conservative estimate without pump-specific context.
  const generalPositions = core.generalClosedPositions ?? 0;
  if (generalPositions <= 0) return 50; // no basis → neutral
  return clamp0to100(generalPositions * 2);
}

function familyTierFromSupport(
  support: Record<SignalPath, SignalSupport>,
  family: SignalPath extends `${infer F}.${string}` ? F : never,
): CoverageTier {
  const entries = Object.entries(support).filter(([key]) => key.startsWith(`${family}.`));
  if (entries.length === 0) return "LOW";

  const totalWeight = entries.reduce(
    (sum, [, value]) => sum + SUPPORT_WEIGHT[value as SignalSupport],
    0,
  );
  const ratio = totalWeight / entries.length;

  if (ratio >= 0.7) return "HIGH";
  if (ratio >= 0.4) return "MEDIUM";
  return "LOW";
}