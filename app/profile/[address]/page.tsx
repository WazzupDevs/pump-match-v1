import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ShareBar } from "@/components/profile/ShareBar";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function originFromHeaders() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function formatHoldTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address: rawAddress } = await params;
  const address = (rawAddress ?? "").trim();
  if (!BASE58_RE.test(address)) return { title: "PumpMatch | Invalid Address" };

  return {
    title: `PumpMatch | ${address.slice(0, 4)}…${address.slice(-4)}`,
    description: "Check out my Solana Trust Score and Pump.fun DNA on PumpMatch!",
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: rawAddress } = await params;
  const address = (rawAddress ?? "").trim();
  if (!BASE58_RE.test(address)) notFound();

  const origin = await originFromHeaders();
  const res = await fetch(`${origin}/api/profile/${address}`, { next: { revalidate: 300 } });

  if (!res.ok) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <p>Wallet analysis failed or address is invalid.</p>
      </main>
    );
  }

  const analysis = await res.json();
  if (!analysis) notFound();

  const trustScore = analysis.trustScore ?? 0;
  const badges: string[] = analysis.badges ?? [];
  const pump = analysis.pumpStats ?? null;
  const profileUrl = `${origin}/profile/${address}`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-12 md:py-20">
        {/* Header Alanı */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-10">
          <div>
            <p className="text-xs font-mono text-emerald-400/80 mb-2">PUMPMATCH VERIFIED PROFILE</p>
            <h1 className="text-3xl md:text-4xl font-bold font-mono tracking-tight">
              {address.slice(0, 4)}
              <span className="text-slate-600">...</span>
              {address.slice(-4)}
            </h1>
          </div>
          <ShareBar address={address} trustScore={trustScore} profileUrl={profileUrl} />
        </div>

        {/* Ana İstatistikler */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="col-span-1 md:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col items-center justify-center relative overflow-hidden">
            <div
              className={`absolute inset-0 opacity-20 blur-3xl ${trustScore >= 80 ? "bg-emerald-500" : trustScore >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
            />
            <p className="text-sm text-slate-400 mb-2 z-10">Trust Score</p>
            <span
              className={`text-7xl font-black tabular-nums tracking-tighter z-10 ${trustScore >= 80 ? "text-emerald-400" : trustScore >= 50 ? "text-amber-400" : "text-rose-400"}`}
            >
              {trustScore}
            </span>
          </div>

          <div className="col-span-1 md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <p className="text-sm text-slate-400 mb-4">Earned Badges</p>
            <div className="flex flex-wrap gap-2">
              {badges.includes("diamond_hands") && (
                <span className="rounded-full bg-emerald-500/15 border border-emerald-400/30 px-3 py-1 text-xs text-emerald-200">
                  💎 Diamond Hands (+20 Pts)
                </span>
              )}
              {badges.includes("mega_jeet") && (
                <span className="rounded-full bg-rose-600/20 border border-rose-500/30 px-3 py-1 text-xs text-rose-200">
                  🐟 Mega Jeet (-30 Pts)
                </span>
              )}
              {badges.includes("rug_magnet") && (
                <span className="rounded-full bg-purple-600/20 border border-purple-400/30 px-3 py-1 text-xs text-purple-200">
                  ☠️ Rug Magnet
                </span>
              )}
              {badges.includes("whale") && (
                <span className="rounded-full bg-blue-500/15 border border-blue-400/30 px-3 py-1 text-xs text-blue-200">
                  🐋 Whale
                </span>
              )}
              {badges.includes("dev") && (
                <span className="rounded-full bg-slate-800 border border-slate-600 px-3 py-1 text-xs text-slate-200">
                  🛠️ Builder
                </span>
              )}
            </div>
            {badges.length === 0 && (
              <p className="text-xs text-slate-500 italic">No badges earned yet.</p>
            )}
          </div>
        </div>

        {/* Pump DNA Kartı */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-950/80 p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">💊 Pump.fun DNA</p>
            {pump?.pumpMintsTouched && pump.pumpMintsTouched >= 3 ? (
              <span className="text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {pump.closedPositions} Trades Closed
              </span>
            ) : null}
          </div>

          {pump == null ? (
            <div className="py-6 text-center border border-dashed border-slate-800 rounded-lg bg-slate-900/30">
              <div className="text-2xl opacity-50">😴</div>
              <div className="mt-2 text-sm font-medium text-slate-400">No Pump Activity</div>
              <div className="text-[10px] text-slate-500 mt-1">
                Either very safe, or very boring.
              </div>
            </div>
          ) : pump.pumpMintsTouched < 3 ? (
            <div className="py-6 text-center border border-dashed border-slate-800 rounded-lg bg-slate-900/30">
              <div className="text-2xl opacity-50">🌱</div>
              <div className="mt-2 text-sm font-medium text-slate-400">Insufficient Data</div>
              <div className="text-[10px] text-slate-500 mt-1">
                Only touched {pump.pumpMintsTouched} tokens. Need at least 3 for a fair verdict.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                  Median Hold Time
                </span>
                <span className="font-mono font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                  {formatHoldTime(pump.medianHoldTimeSeconds)}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                    Jeet Behavior
                  </span>
                  <span className="font-mono text-rose-400 font-bold text-[11px]">
                    {Number.isFinite(pump.jeetScore) ? pump.jeetScore : 0}/100
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-1000"
                    style={{
                      width: `${Math.max(0, Math.min(100, Number.isFinite(pump.jeetScore) ? pump.jeetScore : 0))}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                    Rug Exposure (Dead Bags)
                  </span>
                  <span className="font-mono text-purple-400 font-bold text-[11px]">
                    {Number.isFinite(pump.rugMagnetScore) ? pump.rugMagnetScore : 0}/100
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                    style={{
                      width: `${Math.max(0, Math.min(100, Number.isFinite(pump.rugMagnetScore) ? pump.rugMagnetScore : 0))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
