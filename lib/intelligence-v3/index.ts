import type {
  CoverageAssessment,
  IntelligenceReportV3,
  TransitionalCompatibilityV3,
} from "@/types/intelligence-report-v3";
import type { OnchainCore } from "@/types/intelligence-core";
import { computeBehavioralAxesV3 } from "./axes";
import { computeIntelligenceBadgesV3 } from "./badges";
import { coverageTierFromPercent, clamp0to100 } from "./normalize";
import { computePrimaryStyleClassificationV3 } from "./primary-style";
import { extractBehavioralSignalsV3 } from "./signals";
import {
  buildBehavioralProfileV3,
  buildDeterministicSummaryV3,
} from "./summary";

export * from "./normalize";
export * from "./signals";
export * from "./axes";
export * from "./primary-style";
export * from "./badges";
export * from "./summary";
export * from "./adapters";

export type ComputeIntelligenceReportV3Options = {
  producerVersion: string;
  observationWindowKind?:
    | "ROLLING_30D"
    | "ROLLING_90D"
    | "ROLLING_180D"
    | "CUSTOM";
  observationWindowDays?: number;
  computedAt?: Date;
  transitional?: TransitionalCompatibilityV3;
};

export function computeIntelligenceReportV3(
  core: OnchainCore,
  walletAddress: string,
  options: ComputeIntelligenceReportV3Options,
): IntelligenceReportV3 {
  const computedAt = options.computedAt ?? new Date();
  const observationWindowDays = Math.max(1, options.observationWindowDays ?? 90);
  const observationWindowKind =
    options.observationWindowKind ?? inferWindowKind(observationWindowDays);

  const extracted = extractBehavioralSignalsV3(core, {
    observationWindowDays,
  });

  const { axes, axisReliability } = computeBehavioralAxesV3(extracted);

  const primaryStyle = computePrimaryStyleClassificationV3(extracted, axes);

  const badges = computeIntelligenceBadgesV3(
    extracted,
    axes,
    primaryStyle.label,
  );

  const coverage = buildCoverageAssessment(
    extracted.coverageBasis,
    axisReliability,
  );

  const behavioralProfile = buildBehavioralProfileV3(
    extracted,
    axes,
    primaryStyle,
  );

  const summary = buildDeterministicSummaryV3({
    extracted,
    axes,
    primaryStyle,
    coverage,
    badges,
  });

  return {
    schemaVersion: "intelligence-report.v3",
    producerVersion: options.producerVersion,
    computedAt: computedAt.toISOString(),
    wallet: {
      address: walletAddress,
      chain: "solana",
    },
    observationWindow: {
      kind: observationWindowKind,
      startAt: new Date(
        computedAt.getTime() - observationWindowDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      endAt: computedAt.toISOString(),
    },
    coverage,
    primaryStyle,
    axes,
    signals: extracted.signals,
    badges,
    summary,
    behavioralProfile,
    ...(options.transitional ? { _transitional: options.transitional } : {}),
  };
}

function buildCoverageAssessment(
  basis: {
    txSampleSize: number;
    positionsSampled: number;
    activeDaysObserved: number;
    familyCompleteness: number;
  },
  axisReliability: CoverageAssessment["axisReliability"],
): CoverageAssessment {
  const txScore = clamp0to100(
    basis.txSampleSize >= 100 ? 100 : basis.txSampleSize,
  );
  const positionsScore = clamp0to100(basis.positionsSampled * 8);
  const activeDaysScore = clamp0to100(basis.activeDaysObserved * 6);
  const familyScore = basis.familyCompleteness;

  const overallCoverageScore = clamp0to100(
    txScore * 0.28 +
      positionsScore * 0.24 +
      activeDaysScore * 0.24 +
      familyScore * 0.24,
  );

  return {
    tier: coverageTierFromPercent(overallCoverageScore),
    txSampleSize: basis.txSampleSize,
    positionsSampled: basis.positionsSampled,
    activeDaysObserved: basis.activeDaysObserved,
    familyCompleteness: basis.familyCompleteness,
    axisReliability,
  };
}

function inferWindowKind(
  observationWindowDays: number,
): "ROLLING_30D" | "ROLLING_90D" | "ROLLING_180D" | "CUSTOM" {
  if (observationWindowDays === 30) return "ROLLING_30D";
  if (observationWindowDays === 90) return "ROLLING_90D";
  if (observationWindowDays === 180) return "ROLLING_180D";
  return "CUSTOM";
}