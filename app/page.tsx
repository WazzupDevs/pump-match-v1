"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { Navbar } from "@/components/ui/navbar";
import { Web3LoginButton } from "@/components/auth/Web3LoginButton";
import { useSquadAuth } from "@/components/providers/SquadProvider";
import { supabase } from "@/lib/supabase/client";
import {
  BarChart3,
  Users,
  ShieldCheck,
  Zap,
  ArrowRight,
  Star,
  TrendingUp,
  Swords,
  GitMerge,
  Trophy,
  Crown,
  Medal,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LeaderboardRow {
  rank: number;
  handle: string;
  score: number;
  tier: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "1,337+", label: "Wallets Analyzed" },
  { value: "500+",   label: "Network Agents"   },
  { value: "98+",    label: "Squads Formed"     },
  { value: "99.1%",  label: "Trust Accuracy"   },
];

const FEATURES = [
  {
    icon:      BarChart3,
    iconBg:    "bg-cyan-500/10",
    iconColor: "text-cyan-400",
    topBar:    "from-cyan-500/0 via-cyan-500/60 to-cyan-500/0",
    glow:      "group-hover:shadow-cyan-500/10",
    badge:     "On-Chain Intel",
    title:     "Analyze Your Wallet",
    desc:      "Deep dive into your on-chain history. Calculate 30-day PnL, token win rates, and get assigned a secure Trust Score.",
    bullets: [
      "30-day PnL & win-rate breakdown",
      "Pump.fun trading DNA decoded",
      "Verified Trust Score assigned",
    ],
  },
  {
    icon:      Swords,
    iconBg:    "bg-amber-500/10",
    iconColor: "text-amber-400",
    topBar:    "from-amber-500/0 via-amber-500/60 to-amber-500/0",
    glow:      "group-hover:shadow-amber-500/10",
    badge:     "Season 1 Live",
    title:     "The Arena Leaderboards",
    desc:      "Compete with top Web3 operators. Climb the ranks based on your verified trading reputation and Trust Score.",
    bullets: [
      "Real-time trust rankings",
      "Tier-based progression system",
      "Season rewards & exclusive badges",
    ],
  },
  {
    icon:      Users,
    iconBg:    "bg-violet-500/10",
    iconColor: "text-violet-400",
    topBar:    "from-violet-500/0 via-violet-500/60 to-violet-500/0",
    glow:      "group-hover:shadow-violet-500/10",
    badge:     "Alpha Protocol",
    title:     "Build Elite Squads",
    desc:      "Match with compatible wallets. Pool your alpha, assign roles, and dominate the markets as a team.",
    bullets: [
      "AI-powered compatibility scoring",
      "Role-based squad assembly",
      "On-chain endorsements & rep",
    ],
  },
] as const;

const HOW_IT_WORKS = [
  {
    step:  "01",
    icon:  ShieldCheck,
    color: "text-emerald-400",
    bg:    "bg-emerald-500/10 border-emerald-500/20",
    title: "Connect Your Wallet",
    desc:  "Sign in with Phantom in one click. No email. No password. Your wallet is your identity.",
  },
  {
    step:  "02",
    icon:  Zap,
    color: "text-cyan-400",
    bg:    "bg-cyan-500/10 border-cyan-500/20",
    title: "Scan Your DNA",
    desc:  "We analyse your on-chain history, Pump.fun trades, and token activity to compute your Trust Score.",
  },
  {
    step:  "03",
    icon:  GitMerge,
    color: "text-violet-400",
    bg:    "bg-violet-500/10 border-violet-500/20",
    title: "Match & Dominate",
    desc:  "Get matched with wallets that complement your strengths. Build your squad and enter the Arena.",
  },
] as const;

const TIER_COLORS: Record<string, string> = {
  Legendary:   "text-amber-400",
  Elite:       "text-violet-400",
  Proven:      "text-cyan-400",
  Contributor: "text-emerald-400",
  Newbie:      "text-slate-400",
  EXILED:      "text-red-500",
};

const RANK_ICONS = [Crown, Medal, Trophy];

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard hook — fetches top 5 from trust_metrics + profiles
// ─────────────────────────────────────────────────────────────────────────────

interface RawLbRow {
  composite_score: number;
  tier: string;
  profiles: { x_handle: string | null }[];
}

function useTopOperators(limit = 5) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function fetch() {
      const { data, error } = await supabase
        .from("trust_metrics")
        .select("composite_score, tier, profiles(x_handle)")
        .order("composite_score", { ascending: false })
        .limit(limit);

      if (!alive) return;

      if (error || !data) {
        setLoading(false);
        return;
      }

      const typed = (data ?? []) as unknown as RawLbRow[];
      const mapped: LeaderboardRow[] = typed.map((r, i) => ({
        rank:   i + 1,
        handle: (Array.isArray(r.profiles) ? r.profiles[0]?.x_handle : null) ?? `Operator #${i + 1}`,
        score:  Math.round(r.composite_score ?? 0),
        tier:   r.tier ?? "Newbie",
      }));

      setRows(mapped);
      setLoading(false);
    }

    fetch();
    return () => { alive = false; };
  }, [limit]);

  return { rows, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const { ready, userId } = useSquadAuth();
  const isConnected = ready && !!userId;
  const { rows: leaderboard, loading: lbLoading } = useTopOperators(5);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans overflow-x-hidden">

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <Navbar>
        <Link
          href="/command-center"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-emerald-400 border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 transition-all"
        >
          Launch App
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Navbar>

      {/* ── Ambient background ────────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(16,185,129,1) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute top-0 left-1/4 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-emerald-500/10 blur-[140px]" />
        <div className="absolute top-1/2 right-0 h-[500px] w-[500px] translate-x-1/3 -translate-y-1/2 rounded-full bg-violet-500/8 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-cyan-500/6 blur-[100px]" />
      </div>

      <main className="relative">

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* HERO                                                                   */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <section className="flex min-h-screen flex-col items-center justify-center px-4 pt-24 pb-20 text-center">

          {/* Live badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-4 py-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-widest">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Solana · Season 1 · Live Now
          </div>

          {/* Main title */}
          <h1 className="mx-auto max-w-3xl text-6xl font-black leading-none tracking-tighter sm:text-7xl lg:text-8xl xl:text-9xl">
            <span
              className="bg-gradient-to-br from-emerald-300 via-emerald-400 to-cyan-400 bg-clip-text text-transparent"
              style={{ filter: "drop-shadow(0 0 60px rgba(16,185,129,0.45))" }}
            >
              Pump
            </span>
            <span
              className="bg-gradient-to-br from-violet-300 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent"
              style={{ filter: "drop-shadow(0 0 60px rgba(168,85,247,0.35))" }}
            >
              Match
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-7 max-w-2xl text-base text-slate-400 leading-relaxed sm:text-xl">
            Bridge your on-chain trading history with your Web2 reputation.{" "}
            <span className="text-slate-300">Analyze your wallet, compete in the Arena,</span> and build{" "}
            <span className="text-slate-300">elite Squads</span>.
          </p>

          {/* ── Single CTA cluster — no duplicates ───────────────────────── */}
          <div className="mt-10 flex flex-col items-center gap-3">
            {isConnected ? (
              <>
                <Link
                  href="/command-center"
                  className="group relative inline-flex items-center gap-2.5 rounded-2xl bg-emerald-500 px-9 py-4 text-lg font-black text-slate-900 transition-all duration-200 hover:bg-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/40 active:scale-95"
                >
                  Enter Command Center
                  <span className="text-xl">🚀</span>
                </Link>
                {/* İŞTE BURAYA DISCONNECT BUTONUNU EKLİYORUZ */}
                <Web3LoginButton size="default" />
              </>
            ) : (
              <Web3LoginButton size="lg" />
            )}
          </div>

          {/* Trust tokens */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600">
            {["Powered by Solana", "Secured by Supabase", "PKCE Auth", "Non-custodial"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-emerald-700" />
                {t}
              </span>
            ))}
          </div>

          {/* Scroll hint */}
          <div className="mt-16 opacity-30">
            <div className="mx-auto h-10 w-6 rounded-full border border-slate-700 flex items-start justify-center pt-2">
              <div className="h-2 w-1 rounded-full bg-slate-400 animate-bounce" />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* LIVE LEADERBOARD — Top Operators Preview                              */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <section className="border-y border-slate-800/60">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:py-28">
            <div className="mb-10 text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-amber-500">
                Live Rankings
              </p>
              <h2 className="text-3xl font-black text-slate-100 sm:text-4xl">
                Global Arena{" "}
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Leaderboard
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-slate-500 text-sm leading-relaxed">
                The top operators on Solana, ranked by verified Trust Score. Updated in real time.
              </p>
            </div>

            {/* Glass table */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              {/* Top accent */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0" />

              {/* Header row */}
              <div className="grid grid-cols-[3rem_1fr_5rem_6rem] sm:grid-cols-[3.5rem_1fr_6rem_7rem] items-center px-5 py-3 border-b border-slate-800/70 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                <span>#</span>
                <span>Operator</span>
                <span className="text-right">Score</span>
                <span className="text-right">Tier</span>
              </div>

              {/* Rows */}
              {lbLoading ? (
                <div className="px-5 py-10 text-center">
                  <div className="inline-block h-5 w-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                  <p className="mt-3 text-xs text-slate-600">Loading top operators…</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-600">
                  No arena data yet. Be the first to compete!
                </div>
              ) : (
                leaderboard.map((entry) => {
                  const RankIcon = RANK_ICONS[entry.rank - 1];
                  const rankColors = ["text-amber-400", "text-slate-300", "text-amber-600"];
                  return (
                    <div
                      key={entry.rank}
                      className="grid grid-cols-[3rem_1fr_5rem_6rem] sm:grid-cols-[3.5rem_1fr_6rem_7rem] items-center px-5 py-3.5 border-b border-slate-800/40 last:border-b-0 hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Rank */}
                      <span className="flex items-center">
                        {RankIcon ? (
                          <RankIcon className={`h-4 w-4 ${rankColors[entry.rank - 1]}`} />
                        ) : (
                          <span className="text-sm font-bold text-slate-600 tabular-nums">
                            {entry.rank}
                          </span>
                        )}
                      </span>

                      {/* Handle */}
                      <span className="text-sm font-semibold text-slate-200 truncate">
                        {entry.handle.startsWith("Operator")
                          ? entry.handle
                          : `@${entry.handle}`}
                      </span>

                      {/* Score */}
                      <span className="text-right text-sm font-bold text-emerald-400 tabular-nums">
                        {entry.score}
                      </span>

                      {/* Tier */}
                      <span className={`text-right text-xs font-bold uppercase tracking-wider ${TIER_COLORS[entry.tier] ?? "text-slate-500"}`}>
                        {entry.tier}
                      </span>
                    </div>
                  );
                })
              )}

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-800/70 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-700">
                  Season 1 · Solana Mainnet
                </span>
                <Link
                  href="/command-center"
                  className="text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors inline-flex items-center gap-1"
                >
                  Full Leaderboard
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* STATS STRIP                                                            */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <section className="bg-slate-900/30 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-4 py-7">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1 text-center">
                  <span className="text-2xl font-black text-emerald-400 tabular-nums sm:text-3xl">
                    {s.value}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* FEATURES — bento-style 3-col glass cards                              */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-6xl px-4 py-28 sm:py-36">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-emerald-500">
              Core Loop
            </p>
            <h2 className="text-3xl font-black text-slate-100 sm:text-4xl lg:text-5xl">
              Analyze →{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Compete
              </span>{" "}
              →{" "}
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Squad Up
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-slate-500 text-sm leading-relaxed">
              Three interconnected systems built to surface the sharpest wallets, rank them honestly,
              and unite them into unstoppable squads.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-xl p-7 transition-all duration-300 hover:border-slate-600/70 hover:shadow-xl ${f.glow}`}
                >
                  {/* Top accent line */}
                  <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r ${f.topBar}`} />

                  {/* Icon row */}
                  <div className="mb-5 flex items-center justify-between">
                    <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl ${f.iconBg}`}>
                      <Icon className={`h-6 w-6 ${f.iconColor}`} />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${f.iconColor} opacity-60`}>
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-100 mb-3 leading-tight">
                    {f.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6">
                    {f.desc}
                  </p>

                  <ul className="space-y-2.5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2.5 text-xs text-slate-400">
                        <span className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${f.iconBg.replace("/10", "/60")}`} />
                        {b}
                      </li>
                    ))}
                  </ul>

                  <div
                    className={`absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r ${f.topBar} scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* HOW IT WORKS                                                           */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <section className="border-t border-slate-800/50 bg-slate-900/20">
          <div className="mx-auto max-w-5xl px-4 py-28 sm:py-36">
            <div className="mb-16 text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-cyan-500">
                How It Works
              </p>
              <h2 className="text-3xl font-black text-slate-100 sm:text-4xl">
                Up and running in{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  three steps
                </span>
              </h2>
            </div>

            <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="absolute top-9 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px bg-gradient-to-r from-emerald-500/25 via-cyan-500/25 to-violet-500/25 hidden md:block pointer-events-none" />

              {HOW_IT_WORKS.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.step} className="relative flex flex-col items-center text-center px-4 py-6">
                    <div className={`relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border ${s.bg}`}>
                      <Icon className={`h-7 w-7 ${s.color}`} />
                      <span className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border border-slate-700 text-[9px] font-black text-slate-500">
                        {s.step}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-100 mb-2">{s.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-xs">{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* FINAL CTA                                                              */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <section className="border-t border-slate-800/50">
          <div className="mx-auto max-w-3xl px-4 py-28 sm:py-36 text-center">
            <div className="relative mx-auto max-w-2xl">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 via-cyan-500/8 to-violet-500/10 rounded-3xl blur-2xl pointer-events-none" />

              <div className="relative rounded-3xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl p-10 sm:p-14">
                <div className="mb-5 inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <Logo className="h-10 w-10" />
                </div>

                <h2 className="text-3xl font-black text-slate-100 mb-4 sm:text-4xl leading-tight">
                  Ready to find your{" "}
                  <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    perfect squad?
                  </span>
                </h2>

                <p className="text-slate-400 text-sm leading-relaxed mb-9 max-w-sm mx-auto">
                  Connect your Phantom wallet and let your on-chain history speak for itself.
                  It takes 10 seconds.
                </p>

                <div className="flex flex-col items-center gap-3">
                  {isConnected ? (
                    <>
                      <Link
                        href="/command-center"
                        className="group inline-flex items-center gap-2.5 rounded-2xl bg-emerald-500 px-9 py-4 text-lg font-black text-slate-900 transition-all duration-200 hover:bg-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/40 active:scale-95"
                      >
                        Enter Command Center
                        <span className="text-xl">🚀</span>
                      </Link>
                      {/* İŞTE BURAYA DA DISCONNECT BUTONUNU EKLİYORUZ */}
                      <Web3LoginButton size="default" />
                    </>
                  ) : (
                    <Web3LoginButton size="lg" />
                  )}
                  <p className="text-xs text-slate-700 mt-1">
                    No registration · Non-custodial · Open source
                  </p>
                </div>

                {/* Social proof */}
                <div className="mt-8 pt-8 border-t border-slate-800/70 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Star className="h-3 w-3 text-amber-500" />
                    Top Solana DApp — Season 1
                  </span>
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3 text-emerald-600" />
                    1,337+ wallets onboarded
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 text-cyan-600" />
                    PKCE-secured auth
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="border-t border-slate-800/50 py-10">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-5 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <Logo className="h-5 w-5" />
              <span className="font-semibold text-slate-600">PumpMatch</span>
              <span className="hidden sm:inline">· Season 1 · Powered by Solana</span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://x.com/PumpMatch"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-400 transition-colors"
              >
                X / Twitter
              </a>
              <Link href="/command-center" className="text-emerald-700 hover:text-emerald-500 transition-colors">
                Launch App →
              </Link>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}
