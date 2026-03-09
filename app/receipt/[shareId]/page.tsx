import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getReceiptByShareId } from "@/lib/receipts";

type PageParams = {
  params: Promise<{ shareId: string }>;
};

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function clampScore(value?: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value as number)));
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

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { shareId } = await params;

  return {
    title: `PumpMatch | Receipt ${shareId.slice(0, 6)}`,
    description: "Public intelligence receipt for a Solana wallet on PumpMatch.",
  };
}

export default async function ReceiptPage({ params }: PageParams) {
  const { shareId } = await params;

  if (!shareId || typeof shareId !== "string") {
    notFound();
  }

  const result = await getReceiptByShareId(shareId);
  if (!result) {
    notFound();
  }

  const { receipt, snapshot } = result;

  const maskedAddress = shortenAddress(receipt.walletAddress);
  const styleScores = snapshot.style;
  const qualityScores = snapshot.quality;
  const riskScores = snapshot.risk;
  const confidence = snapshot.confidence;
  const summary = snapshot.summary;
  const computedAt = new Date(snapshot.computedAt);

  const compatibilityScore = clampScore(snapshot.quality.overall);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.06),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.05),transparent_18%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.04),transparent_20%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-400/80">
              Public Intelligence Receipt
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">
              {maskedAddress}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              This page shows a published intelligence snapshot for this wallet. The URL is
              share-based and does not expose the raw address.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Snapshot computed at{" "}
              <span className="font-mono">
                {computedAt.toLocaleString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              .
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
              {summary.primaryStyle}
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-300">
              {summary.scoreLabel}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              {summary.summary}
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 font-medium text-cyan-200">
                Confidence {confidence.tier}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 font-medium text-slate-300">
                Sample Size {confidence.sampleSize}
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <div className="absolute inset-0 opacity-30 blur-3xl bg-emerald-500/15" />
            <p className="relative z-10 mb-2 text-sm text-slate-400">
              Compatibility Surface
            </p>
            <div className="relative z-10 text-5xl font-black tracking-tighter text-emerald-300">
              {compatibilityScore}
            </div>
            <p className="relative z-10 mt-3 text-xs text-slate-500">
              Legacy compatibility score derived from this wallet&apos;s quality axis. The primary style, quality, risk, and confidence above are the canonical intelligence view.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 backdrop-blur-xl">
            <p className="mb-2 text-sm text-slate-400">Style Scores</p>
            <p className="mb-4 text-xs leading-6 text-slate-500">
              Estimated market behavior style based on on-chain activity.
            </p>
            <div className="space-y-4">
              {Object.entries(styleScores).map(([key, value]) => (
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
              {Object.entries(qualityScores).map(([key, value]) => (
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
              {Object.entries(riskScores).map(([key, value]) => (
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
      </div>
    </main>
  );
}

