import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { analyzeWallet } from "@/app/actions/analyzeWallet";
import { normalizeWalletAddress } from "@/lib/solana/normalizeWalletAddress";
import type { WalletAnalysis } from "@/types";

/**
 * /analyze/[address] — Dedicated wallet analysis result route.
 *
 * Server Component only. Does NOT access window.solana or any wallet provider.
 * Does NOT depend on /profile or /receipt logic.
 *
 * Separation of concerns:
 *   /analyze/[address]  = private/default analysis result (this page)
 *   /profile/[address]  = staged public fallback (visibility-gated)
 *   /receipt/[shareId]  = canonical public share (consent-first)
 */

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function clampScore(value?: number | null) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value as number)));
}

function scoreTone(score: number) {
  if (score >= 80)
    return {
      text: "text-emerald-300",
      ring: "border-emerald-500/20",
      glow: "bg-emerald-500/15",
    };
  if (score >= 50)
    return {
      text: "text-amber-300",
      ring: "border-amber-500/20",
      glow: "bg-amber-500/15",
    };
  return {
    text: "text-rose-300",
    ring: "border-rose-500/20",
    glow: "bg-rose-500/15",
  };
}

function barTone(value: number) {
  if (value >= 75) return "from-emerald-500 to-cyan-500";
  if (value >= 50) return "from-amber-500 to-orange-500";
  return "from-rose-500 to-red-500";
}

function metricLabel(key: string) {
  switch (key) {
    case "sniper":
      return "Sniper";
    case "scalper":
      return "Scalper";
    case "swing":
      return "Swing";
    case "conviction":
      return "Conviction";
    case "consistency":
      return "Consistency";
    case "pnlQuality":
      return "PnL Quality";
    case "longevity":
      return "Longevity";
    case "overall":
      return "Overall";
    case "churn":
      return "Churn";
    case "rugExposure":
      return "Rug Exposure";
    case "suspiciousness":
      return "Suspiciousness";
    default:
      return key;
  }
}

function badgeMeta(badge: string) {
  switch (badge) {
    case "diamond_hands":
      return {
        label: "Diamond Hands",
        className:
          "border border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
      };
    case "mega_jeet":
      return {
        label: "High Churn",
        className:
          "border border-rose-400/25 bg-rose-500/10 text-rose-200",
      };
    case "rug_magnet":
      return {
        label: "Rug Exposure",
        className:
          "border border-violet-400/25 bg-violet-500/10 text-violet-200",
      };
    case "whale":
      return {
        label: "Whale",
        className:
          "border border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
      };
    case "dev":
      return {
        label: "Builder",
        className:
          "border border-slate-500/25 bg-slate-800/80 text-slate-200",
      };
    case "og_wallet":
      return {
        label: "OG Wallet",
        className:
          "border border-amber-400/25 bg-amber-500/10 text-amber-200",
      };
    case "community_trusted":
      return {
        label: "Community Trusted",
        className:
          "border border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200",
      };
    default:
      return {
        label: badge,
        className:
          "border border-slate-500/25 bg-slate-900/80 text-slate-300",
      };
  }
}

function formatUsd(value?: number | null) {
  if (!Number.isFinite(value)) return "\u2014";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: (value as number) >= 1000 ? 0 : 2,
  }).format(value as number);
}

function formatNumber(value?: number | null) {
  if (!Number.isFinite(value)) return "\u2014";
  return new Intl.NumberFormat("en-US").format(value as number);
}

function formatDays(value?: number | null) {
  if (!Number.isFinite(value)) return "\u2014";
  return `${Math.round(value as number)}d`;
}

function formatHoldTime(seconds?: number | null) {
  if (!Number.isFinite(seconds)) return "\u2014";
  if ((seconds as number) < 60) return `${Math.round(seconds as number)}s`;
  if ((seconds as number) < 3600)
    return `${Math.floor((seconds as number) / 60)}m`;
  if ((seconds as number) < 86400)
    return `${((seconds as number) / 3600).toFixed(1)}h`;
  return `${((seconds as number) / 86400).toFixed(1)}d`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address: rawAddress } = await params;
  const result = normalizeWalletAddress(rawAddress);

  if (!result.ok) {
    return { title: "PumpMatch | Invalid Address" };
  }

  return {
    title: `PumpMatch | Analyze ${shortenAddress(result.address)}`,
    description:
      "Wallet intelligence analysis on PumpMatch \u2014 behavioral style, quality, risk, and confidence signals for a Solana wallet.",
  };
}

export default async function AnalyzePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: rawAddress } = await params;
  const normalized = normalizeWalletAddress(rawAddress);

  // Invalid address → 404 (not an error, just a bad URL)
  if (!normalized.ok) {
    notFound();
  }

  const address = normalized.address;

  let wa: WalletAnalysis;
  try {
    const response = await analyzeWallet(address);
    wa = response.walletAnalysis;
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : "";
    const isRateLimit =
      rawMsg.includes("Rate limit") || rawMsg.includes("429");

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center backdrop-blur-xl">
          {isRateLimit ? (
            <>
              <p className="text-sm text-amber-400">
                Too many requests. Please try again in a few minutes.
              </p>
              <Link
                href={`/analyze/${address}`}
                className="mt-4 inline-block text-xs text-slate-400 transition-colors hover:text-slate-200"
              >
                Retry analysis
              </Link>
            </>
          ) : (
            <p className="text-sm text-rose-400">
              Analysis temporarily unavailable. Please try again.
            </p>
          )}
          <Link
            href="/"
            className="mt-4 inline-block text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  // V3 Projection Bridge: prefer v3-derived legacy values when feature flag is active
  const useV3Projection =
    process.env.PUMPMATCH_ANALYZE_V3_PROJECTION === "1" &&
    !!wa.legacyProjectionFromV3;

  if (useV3Projection) {
    const p = wa.legacyProjectionFromV3!;
    wa = {
      ...wa,
      styleScores: p.styleScores,
      qualityScores: p.qualityScores,
      riskScores: p.riskScores,
      intelligenceConfidence: p.intelligenceConfidence,
      intelligenceSummary: p.intelligenceSummary,
    };
  }

  const compatibilityScore = clampScore(wa.qualityScores?.overall);
  const tone = scoreTone(compatibilityScore);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.06),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.05),transparent_18%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.04),transparent_20%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-400/80">
              Wallet Intelligence
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">
              {shortenAddress(address)}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Full behavioral intelligence analysis for this Solana wallet.
              Style, quality, risk, and confidence signals derived from
              on-chain activity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/arena"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/8"
            >
              View Arena
            </Link>
            {/* TODO: Add "Publish Receipt" action once a client-facing
                receipt publish flow exists. Requires snapshotId from the
                analysis pipeline to call createReceipt(). */}
            <Link
              href="/command-center"
              className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Launch App
            </Link>
          </div>
        </div>

        {/* Primary intelligence + compatibility score */}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-3 text-sm text-slate-400">Primary Style</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-100">
              {wa.intelligenceSummary?.primaryStyle ?? "Unknown"}
            </h2>
            {wa.intelligenceSummary?.scoreLabel ? (
              <p className="mt-2 text-sm font-medium text-slate-300">
                {wa.intelligenceSummary.scoreLabel}
              </p>
            ) : null}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              {wa.intelligenceSummary?.summary ??
                "No intelligence summary available yet."}
            </p>

            {wa.intelligenceConfidence ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                  Confidence {wa.intelligenceConfidence.tier}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-300">
                  Sample Size {wa.intelligenceConfidence.sampleSize}
                </span>
                {wa.intelligenceSummary?.primaryStyle ? (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    {wa.intelligenceSummary.primaryStyle}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            className={`relative overflow-hidden rounded-3xl border bg-slate-900/55 p-6 backdrop-blur-xl ${tone.ring}`}
          >
            <div
              className={`absolute inset-0 opacity-30 blur-3xl ${tone.glow}`}
            />
            <p className="relative z-10 mb-2 text-sm text-slate-500">
              Compatibility score (transitional)
            </p>
            <div
              className={`relative z-10 text-4xl font-black tracking-tighter ${tone.text}`}
            >
              {compatibilityScore}
            </div>
            <p className="relative z-10 mt-3 text-xs text-slate-500">
              Legacy scalar for compatibility. Primary style, quality, risk,
              and confidence above are the intelligence surface.
            </p>
          </div>
        </div>

        {/* Style / Quality / Risk score bars */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-2 text-sm text-slate-400">Style Scores</p>
            <p className="mb-4 text-xs leading-6 text-slate-500">
              Estimated market behavior style based on on-chain activity.
            </p>
            <div className="space-y-4">
              {Object.entries(wa.styleScores ?? {}).map(([key, value]) => (
                <div key={key}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="uppercase tracking-wider text-slate-500">
                      {metricLabel(key)}
                    </span>
                    <span className="font-mono font-semibold text-slate-200">
                      {clampScore(value)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full border border-slate-800 bg-slate-950">
                    <div
                      className={`h-full bg-linear-to-r ${barTone(clampScore(value))}`}
                      style={{ width: `${clampScore(value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-2 text-sm text-slate-400">Quality Scores</p>
            <p className="mb-4 text-xs leading-6 text-slate-500">
              Signal quality, durability, and consistency over time.
            </p>
            <div className="space-y-4">
              {Object.entries(wa.qualityScores ?? {}).map(([key, value]) => (
                <div key={key}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="uppercase tracking-wider text-slate-500">
                      {metricLabel(key)}
                    </span>
                    <span className="font-mono font-semibold text-slate-200">
                      {clampScore(value)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full border border-slate-800 bg-slate-950">
                    <div
                      className={`h-full bg-linear-to-r ${barTone(clampScore(value))}`}
                      style={{ width: `${clampScore(value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-2 text-sm text-slate-400">Risk Scores</p>
            <p className="mb-4 text-xs leading-6 text-slate-500">
              Churn, rug exposure, and overall suspiciousness signals.
            </p>
            <div className="space-y-4">
              {Object.entries(wa.riskScores ?? {}).map(([key, value]) => (
                <div key={key}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="uppercase tracking-wider text-slate-500">
                      {metricLabel(key)}
                    </span>
                    <span className="font-mono font-semibold text-slate-200">
                      {clampScore(value)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full border border-slate-800 bg-slate-950">
                    <div
                      className={`h-full bg-linear-to-r ${barTone(clampScore(value))}`}
                      style={{ width: `${clampScore(value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Public signals / badges */}
        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
          <p className="mb-4 text-sm text-slate-400">Signals</p>
          {(wa.badges ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {wa.badges.map((badge) => {
                const meta = badgeMeta(badge);
                return (
                  <span
                    key={badge}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm italic text-slate-500">
              No signal badges available yet.
            </p>
          )}
        </div>

        {/* Signal summary + behavioral layer */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-4 text-sm text-slate-400">Signal Summary</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Transactions
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-200">
                  {formatNumber(wa.transactionCount)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Token Diversity
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-200">
                  {formatNumber(wa.tokenDiversity)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Wallet Age
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-200">
                  {formatDays(wa.approxWalletAge)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Portfolio Value
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-200">
                  {formatUsd(wa.portfolioValueUsd)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-4 text-sm text-slate-400">Behavioral Signals</p>

            {/* General behavioral metrics — derived from all token trades */}
            <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-slate-600">
              General Behavior
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Avg Hold Time
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-200">
                  {formatHoldTime(wa.behavioral?.avgHoldingTimeSec)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Trade Frequency
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-200">
                  {clampScore(wa.behavioral?.tradeFreqScore)}
                </p>
              </div>
            </div>

            {/* Pump.fun legacy overlay — only meaningful when pump activity exists */}
            <div className="mt-5 border-t border-slate-800/70 pt-4">
              <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-slate-600">
                Pump.fun Overlay
              </p>
              {(wa.pumpStats?.pumpMintsTouched ?? 0) >= 1 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Jeet Index
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-200">
                      {clampScore(wa.behavioral?.jeetIndex)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Rug Exposure
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-200">
                      {clampScore(wa.behavioral?.rugExposureIndex)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600">No pump.fun activity detected</p>
              )}
            </div>

            {wa.behavioral?.evidenceSources ? (
              <p className="mt-4 text-xs leading-6 text-slate-500">
                Sources: {wa.behavioral.evidenceSources}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
