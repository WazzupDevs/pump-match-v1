import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type BehavioralMetrics = {
  jeetIndex?: number;
  rugExposureIndex?: number;
  avgHoldingTimeSec?: number;
  tradeFreqScore?: number;
  confidenceLabel?: string;
};

type PumpStats = {
  pumpMintsTouched: number;
  closedPositions: number;
  medianHoldTimeSeconds: number;
  jeetScore: number;
  rugMagnetScore: number;
  confidence?: string;
};

type WalletAnalysis = {
  address: string;
  trustScore?: number;
  scoreLabel?: string;
  badges?: string[];
  solBalance?: number;
  tokenCount?: number;
  nftCount?: number;
  assetCount?: number;
  transactionCount?: number;
  tokenDiversity?: number;
  approxWalletAge?: number;
  portfolioValueUsd?: number;
  behavioral?: BehavioralMetrics;
  pumpStats?: PumpStats | null;
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

function badgeMeta(badge: string) {
  switch (badge) {
    case "diamond_hands":
      return {
        label: "Diamond Hands",
        emoji: "💎",
        className:
          "border border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
      };
    case "mega_jeet":
      return {
        label: "High Churn",
        emoji: "🐟",
        className:
          "border border-rose-400/25 bg-rose-500/10 text-rose-200",
      };
    case "rug_magnet":
      return {
        label: "Rug Exposure",
        emoji: "☠️",
        className:
          "border border-violet-400/25 bg-violet-500/10 text-violet-200",
      };
    case "whale":
      return {
        label: "Whale",
        emoji: "🐋",
        className:
          "border border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
      };
    case "dev":
      return {
        label: "Builder",
        emoji: "🛠️",
        className:
          "border border-slate-500/25 bg-slate-800/80 text-slate-200",
      };
    case "og_wallet":
      return {
        label: "OG Wallet",
        emoji: "🧠",
        className:
          "border border-amber-400/25 bg-amber-500/10 text-amber-200",
      };
    case "community_trusted":
      return {
        label: "Community Trusted",
        emoji: "🛡️",
        className:
          "border border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200",
      };
    default:
      return {
        label: badge,
        emoji: "•",
        className:
          "border border-slate-500/25 bg-slate-900/80 text-slate-300",
      };
  }
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

  const analysis = (await res.json()) as WalletAnalysis;
  if (!analysis) notFound();

  const trustScore = clampScore(analysis.trustScore);
  const tone = scoreTone(trustScore);
  const badges = analysis.badges ?? [];
  const behavioral = analysis.behavioral;
  const pump = analysis.pumpStats ?? null;

  const shareText = encodeURIComponent(
    `Public behavioral analysis for ${shortenAddress(address)} on PumpMatch`
  );
  const shareUrl = encodeURIComponent(`${origin}/profile/${address}`);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.06),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.05),transparent_18%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.04),transparent_20%)]" />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 md:py-20">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-400/80">
              Public Behavioral Analysis
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">
              {shortenAddress(address)}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              A public view of visible behavioral signals for this wallet.
              Full wallet identity is masked by default on the page surface.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`https://x.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/8"
            >
              Share on X
            </a>
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

        <div className="grid gap-6 md:grid-cols-3">
          <div
            className={`relative overflow-hidden rounded-3xl border bg-slate-900/55 p-6 backdrop-blur-xl ${tone.ring}`}
          >
            <div className={`absolute inset-0 opacity-30 blur-3xl ${tone.glow}`} />
            <p className="relative z-10 mb-2 text-sm text-slate-400">
              Public Signal Score
            </p>
            <div className={`relative z-10 text-7xl font-black tracking-tighter ${tone.text}`}>
              {trustScore}
            </div>
            <p className="relative z-10 mt-3 text-sm text-slate-500">
              {analysis.scoreLabel ?? "Visible reputation surface"}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl md:col-span-2">
            <p className="mb-4 text-sm text-slate-400">Signal Summary</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
          <p className="mb-4 text-sm text-slate-400">Earned Signals</p>

          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => {
                const meta = badgeMeta(badge);
                return (
                  <span
                    key={badge}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${meta.className}`}
                  >
                    <span>{meta.emoji}</span>
                    <span>{meta.label}</span>
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
            <p className="mb-4 text-sm text-slate-400">Behavioral Layer</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Jeet Index
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-200">
                  {clampScore(behavioral?.jeetIndex)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Rug Exposure
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-200">
                  {clampScore(behavioral?.rugExposureIndex)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Avg Hold Time
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-200">
                  {formatHoldTime(behavioral?.avgHoldingTimeSec)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Trade Frequency
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-200">
                  {clampScore(behavioral?.tradeFreqScore)}
                </p>
              </div>
            </div>

            <p className="mt-5 text-sm text-slate-500">
              {behavioral?.confidenceLabel ??
                "Behavioral metrics are derived from currently available public data."}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-4 text-sm text-slate-400">Pump.fun Activity</p>

            {pump == null ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 px-5 py-8 text-center">
                <div className="text-2xl opacity-50">😴</div>
                <p className="mt-3 text-sm font-medium text-slate-400">
                  No pump activity detected
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Either there is not enough data, or this wallet is inactive on Pump.fun.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Tokens Touched
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-200">
                      {formatNumber(pump.pumpMintsTouched)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Closed Positions
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-200">
                      {formatNumber(pump.closedPositions)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Median Hold Time
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-200">
                      {formatHoldTime(pump.medianHoldTimeSeconds)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Confidence
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-200">
                      {pump.confidence ?? "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="uppercase tracking-wider text-slate-500">
                      Jeet Behavior
                    </span>
                    <span className="font-mono font-semibold text-rose-300">
                      {clampScore(pump.jeetScore)}/100
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full border border-slate-800 bg-slate-950">
                    <div
                      className="h-full bg-linear-to-r from-amber-500 to-rose-500 transition-[width] duration-700"
                      style={{ width: `${clampScore(pump.jeetScore)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="uppercase tracking-wider text-slate-500">
                      Rug Exposure
                    </span>
                    <span className="font-mono font-semibold text-violet-300">
                      {clampScore(pump.rugMagnetScore)}/100
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full border border-slate-800 bg-slate-950">
                    <div
                      className="h-full bg-linear-to-r from-indigo-500 to-violet-500 transition-[width] duration-700"
                      style={{ width: `${clampScore(pump.rugMagnetScore)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}