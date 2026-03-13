import type {
    AxisStatus,
    CoverageTier,
    EnumSignal,
    NumericSignal,
    TierSignal,
  } from "@/types/intelligence-report-v3";

  export type SignalSupport = "MEASURED" | "PROXY" | "UNAVAILABLE";

  /**
   * Support weights for signal provenance.
   * MEASURED = directly observed from on-chain data with full fidelity.
   * PROXY   = derived/estimated from available but incomplete data.
   */
  export const SUPPORT_WEIGHT: Record<SignalSupport, number> = {
    MEASURED: 1.0,
    PROXY: 0.5,
    UNAVAILABLE: 0.0,
  };

  export function clamp0to100(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  export function safeDivide(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return 0;
    }
    return numerator / denominator;
  }

  export function ratioToPercent(ratio: number): number {
    return clamp0to100(ratio * 100);
  }

  export function numericSignal(
    value: number,
    core: boolean,
  ): NumericSignal {
    return {
      kind: "number",
      value: clamp0to100(value),
      core,
    };
  }

  export function tierSignal<T extends string>(
    value: T,
    core: boolean,
  ): TierSignal<T> {
    return {
      kind: "tier",
      value,
      core,
    };
  }

  export function enumSignal<T extends string>(
    value: T,
    core: boolean,
  ): EnumSignal<T> {
    return {
      kind: "enum",
      value,
      core,
    };
  }

  export function scoreToThreeTier(score: number): "LOW" | "MEDIUM" | "HIGH" {
    const normalized = clamp0to100(score);
    if (normalized >= 67) return "HIGH";
    if (normalized >= 34) return "MEDIUM";
    return "LOW";
  }

  export function holdDurationTierFromSeconds(
    seconds: number | null | undefined,
  ): "VERY_SHORT" | "SHORT" | "MEDIUM" | "LONG" {
    if (!seconds || seconds <= 0) return "MEDIUM";
    if (seconds < 60 * 60) return "VERY_SHORT"; // < 1h
    if (seconds < 24 * 60 * 60) return "SHORT"; // < 1d
    if (seconds < 7 * 24 * 60 * 60) return "MEDIUM"; // < 7d
    return "LONG";
  }

  export function scoreToReEntryPattern(
    score: number,
  ): "RARE" | "OCCASIONAL" | "FREQUENT" {
    const normalized = clamp0to100(score);
    if (normalized >= 67) return "FREQUENT";
    if (normalized >= 34) return "OCCASIONAL";
    return "RARE";
  }

  export function scoreToBridgeUsagePattern(
    score: number,
  ): "NONE" | "OCCASIONAL" | "FREQUENT" {
    const normalized = clamp0to100(score);
    if (normalized >= 67) return "FREQUENT";
    if (normalized >= 34) return "OCCASIONAL";
    return "NONE";
  }

  export function scoreToSpeculationBias(
    score: number,
  ): "STAKING_LEANING" | "BALANCED" | "SPECULATION_LEANING" {
    const normalized = clamp0to100(score);
    if (normalized >= 67) return "SPECULATION_LEANING";
    if (normalized >= 34) return "BALANCED";
    return "STAKING_LEANING";
  }

  export function invert100(score: number): number {
    return clamp0to100(100 - clamp0to100(score));
  }

  export function concentrationFromTokenDiversity(tokenDiversity: number): number {
    const diversity = Math.max(0, Math.min(20, tokenDiversity));
    // Low diversity => high concentration, capped at 20 distinct assets for now.
    return clamp0to100((1 - diversity / 20) * 100);
  }

  export function txTempoFromTradesPerActiveDay(
    tradesPerActiveDay: number,
  ): "LOW" | "MEDIUM" | "HIGH" {
    if (tradesPerActiveDay >= 8) return "HIGH";
    if (tradesPerActiveDay >= 3) return "MEDIUM";
    return "LOW";
  }

  export function coverageTierFromPercent(percent: number): CoverageTier {
    const normalized = clamp0to100(percent);
    if (normalized >= 70) return "HIGH";
    if (normalized >= 40) return "MEDIUM";
    return "LOW";
  }

  /**
   * Compute weighted support ratio and measured presence from a list of signal supports.
   * Returns { weighted, measuredFraction } where both are in [0, 1].
   */
  export function weightedSupportRatio(
    supports: readonly SignalSupport[],
  ): { weighted: number; measuredFraction: number } {
    if (supports.length === 0) return { weighted: 0, measuredFraction: 0 };

    const totalWeight = supports.reduce(
      (sum, s) => sum + SUPPORT_WEIGHT[s],
      0,
    );
    const measuredCount = supports.filter((s) => s === "MEASURED").length;

    return {
      weighted: totalWeight / supports.length,
      measuredFraction: measuredCount / supports.length,
    };
  }

  export function axisStatusFromSupportRatio(
    weightedRatio: number,
    measuredFraction: number,
    hardInsufficient = false,
  ): AxisStatus {
    if (hardInsufficient) return "INSUFFICIENT";
    // MEASURED only when weighted support is strong AND at least half the signals are truly measured
    if (weightedRatio >= 0.7 && measuredFraction >= 0.5) return "MEASURED";
    // ESTIMATED when there is usable support (even if entirely proxy-derived)
    if (weightedRatio >= 0.25) return "ESTIMATED";
    return "INSUFFICIENT";
  }