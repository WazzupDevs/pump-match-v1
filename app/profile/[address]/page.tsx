import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getLatestPublicReceipt } from "@/lib/receipts";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type PublicWalletAnalysis = {
  address: string;
  trustScore: number;
  scoreLabel: string;
  badges: string[];
  solBalance: number;
  tokenCount: number;
  nftCount: number;
  assetCount: number;
  transactionCount: number;
  tokenDiversity: number;
  approxWalletAge: number;
  portfolioValueUsd: number;
  behavioral: {
    jeetIndex: number;
    rugExposureIndex: number;
    avgHoldingTimeSec: number;
    tradeFreqScore: number;
    confidenceLabel: string;
  } | null;
  pumpStats: {
    pumpMintsTouched: number;
    closedPositions: number;
    medianHoldTimeSeconds: number;
    jeetScore: number;
    rugMagnetScore: number;
    confidence: string;
  } | null;
  styleScores: {
    sniper: number;
    scalper: number;
    swing: number;
    conviction: number;
  } | null;
  qualityScores: {
    consistency: number;
    pnlQuality: number;
    longevity: number;
    overall: number;
  } | null;
  riskScores: {
    churn: number;
    rugExposure: number;
    suspiciousness: number;
  } | null;
  intelligenceConfidence: {
    overall: number;
    label: "LOW" | "MEDIUM" | "HIGH";
    sampleSize: number;
  } | null;
  intelligenceSummary: {
    primaryStyle: string;
    summary: string;
  } | null;
};

async function originFromHeaders() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function clampScore(value?: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value as number)));
}

function formatUsd(value?: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value! >= 1000 ? 0 : 2,
  }).format(value as number);
}

function formatNumber(value?: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value as number);
}

function formatDays(value?: number) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value as number)}d`;
}

function formatHoldTime(seconds?: number) {
  if (!Number.isFinite(seconds)) return "—";
  if ((seconds as number) < 60) return `${Math.round(seconds as number)}s`;
  if ((seconds as number) < 3600) return `${Math.floor((seconds as number) / 60)}m`;
  if ((seconds as number) < 86400) return `${((seconds as number) / 3600).toFixed(1)}h`;
  return `${((seconds as number) / 86400).toFixed(1)}d`;
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

function scoreTone(score: number) {
  if (score >= 80) {
    return {
      text: "text-emerald-300",
      ring: "border-emerald-500/20",
      glow: "bg-emerald-500/15",
    };
  }

  if (score >= 50) {
    return {
      text: "text-amber-300",
      ring: "border-amber-500/20",
      glow: "bg-amber-500/15",
    };
  }

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address: rawAddress } = await params;
  const address = (rawAddress ?? "").trim();

  if (!BASE58_RE.test(address)) {
    return { title: "PumpMatch | Invalid Address" };
  }

  return {
    title: `PumpMatch | ${shortenAddress(address)}`,
    description:
      "Public behavioral analysis for a Solana wallet on PumpMatch.",
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: rawAddress } = await params;

  let address = (rawAddress ?? "").trim();
  if (address.startsWith("web3:solana:")) {
    address = address.slice("web3:solana:".length);
  }

  if (!BASE58_RE.test(address)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <p>Invalid wallet address.</p>
      </main>
    );
  }

  // Phase 2C: If a public receipt exists, redirect to canonical receipt route.
  const latestReceipt = await getLatestPublicReceipt(address);
  if (latestReceipt) {
    redirect(`/receipt/${latestReceipt.shareId}`);
  }

  const origin = await originFromHeaders();
  const res = await fetch(`${origin}/api/profile/${address}`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <p>Wallet analysis failed or address is invalid.</p>
      </main>
    );
  }

  const analysis = (await res.json()) as PublicWalletAnalysis;
  if (!analysis) notFound();

  const trustScore = clampScore(analysis.trustScore);
  const tone = scoreTone(trustScore);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.06),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.05),transparent_18%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.04),transparent_20%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-400/80">
              Public Behavioral Intelligence
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">
              {shortenAddress(address)}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              A calm, explainable view of this wallet&apos;s public behavioral signals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/arena"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/8"
            >
              View Arena
            </Link>
            <Link
              href="/command-center"
              className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Launch App
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-3 text-sm text-slate-400">Primary Style</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-100">
              {analysis.intelligenceSummary?.primaryStyle ?? "Unknown"}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              {analysis.intelligenceSummary?.summary ??
                "No intelligence summary available yet."}
            </p>

            {analysis.intelligenceConfidence ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                  Confidence {analysis.intelligenceConfidence.label}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-300">
                  Sample Size {analysis.intelligenceConfidence.sampleSize}
                </span>
                {analysis.intelligenceSummary?.primaryStyle ? (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    {analysis.intelligenceSummary.primaryStyle}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            className={`relative overflow-hidden rounded-3xl border bg-slate-900/55 p-6 backdrop-blur-xl ${tone.ring}`}
          >
            <div className={`absolute inset-0 opacity-30 blur-3xl ${tone.glow}`} />
            <p className="relative z-10 mb-2 text-sm text-slate-400">
              Legacy Public Score
            </p>
            <div className={`relative z-10 text-5xl font-black tracking-tighter ${tone.text}`}>
              {trustScore}
            </div>
            <p className="relative z-10 mt-3 text-xs text-slate-500">
              Compatibility score derived from public behavioral signals. Primary style, quality, risk, and confidence are the canonical intelligence surface.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-2 text-sm text-slate-400">Style Scores</p>
            <p className="mb-4 text-xs leading-6 text-slate-500">
              These scores estimate how this wallet behaves in markets.
            </p>

            <div className="space-y-4">
              {Object.entries(analysis.styleScores ?? {}).map(([key, value]) => (
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
              These scores estimate signal quality, durability, and consistency.
            </p>

            <div className="space-y-4">
              {Object.entries(analysis.qualityScores ?? {}).map(([key, value]) => (
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
              These scores highlight churn, rug exposure, and suspiciousness.
            </p>

            <div className="space-y-4">
              {Object.entries(analysis.riskScores ?? {}).map(([key, value]) => (
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

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
          <p className="mb-4 text-sm text-slate-400">Public Signals</p>

          {(analysis.badges ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {analysis.badges.map((badge) => {
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
              No public signal badges available yet.
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-4 text-sm text-slate-400">Signal Summary</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Transactions
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-200">
                  {formatNumber(analysis.transactionCount)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Token Diversity
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-200">
                  {formatNumber(analysis.tokenDiversity)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Wallet Age
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-200">
                  {formatDays(analysis.approxWalletAge)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Portfolio Value
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-200">
                  {formatUsd(analysis.portfolioValueUsd)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-4 text-sm text-slate-400">Behavioral Layer</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Jeet Index
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-200">
                  {clampScore(analysis.behavioral?.jeetIndex)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Rug Exposure
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-200">
                  {clampScore(analysis.behavioral?.rugExposureIndex)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Avg Hold Time
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-200">
                  {formatHoldTime(analysis.behavioral?.avgHoldingTimeSec)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Trade Frequency
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-200">
                  {clampScore(analysis.behavioral?.tradeFreqScore)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}