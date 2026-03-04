"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Navbar } from "@/components/ui/navbar";
import { Web3LoginButton } from "@/components/auth/Web3LoginButton";
import {
  BarChart3,
  Swords,
  Users,
  ShieldCheck,
  Zap,
  ArrowRight,
  Star,
  TrendingUp,
  Sparkles,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "1,337+", label: "Wallets Analyzed" },
  { value: "500+",   label: "Network Agents"   },
  { value: "98+",    label: "Squads Formed"     },
  { value: "99.1%",  label: "Trust Accuracy"   },
];

const FEATURES = [
  {
    icon:     BarChart3,
    accent:   "cyan",
    iconBg:   "bg-cyan-500/10",
    iconColor:"text-cyan-400",
    border:   "hover:border-cyan-500/30",
    glow:     "from-cyan-500/6",
    badge:    "On-Chain Intel",
    title:    "Wallet Analysis",
    desc:     "Deep-dive into PnL, win rates, Pump.fun DNA, jeet scores, and token diversity. Your on-chain CV, fully decoded.",
    bullets:  ["Pump.fun trading DNA", "Jeet & rug-magnet metrics", "Token diversity score"],
  },
  {
    icon:     Swords,
    accent:   "amber",
    iconBg:   "bg-amber-500/10",
    iconColor:"text-amber-400",
    border:   "hover:border-amber-500/30",
    glow:     "from-amber-500/6",
    badge:    "Season 1 Live",
    title:    "Arena Leaderboards",
    desc:     "Compete with the sharpest wallets on Solana. Climb tiers from Newbie to Legendary and prove your edge.",
    bullets:  ["Real-time trust rankings", "Tier-based progression", "Season rewards & badges"],
  },
  {
    icon:     Users,
    accent:   "violet",
    iconBg:   "bg-violet-500/10",
    iconColor:"text-violet-400",
    border:   "hover:border-violet-500/30",
    glow:     "from-violet-500/6",
    badge:    "Alpha Protocol",
    title:    "Squads",
    desc:     "Match with verified devs, whales, and builders. Form squads, pool alpha, and dominate launches together.",
    bullets:  ["AI-powered match scoring", "Role-based squad assembly", "On-chain endorsements"],
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon:  ShieldCheck,
    color: "text-emerald-400",
    bg:    "bg-emerald-500/10 border-emerald-500/20",
    title: "Connect Your Wallet",
    desc:  "Sign in with Phantom in one click. No email. No password. Your wallet is your identity.",
  },
  {
    step: "02",
    icon:  Zap,
    color: "text-cyan-400",
    bg:    "bg-cyan-500/10 border-cyan-500/20",
    title: "Scan Your DNA",
    desc:  "We analyse your on-chain history, Pump.fun trades, and token activity to compute your Trust Score.",
  },
  {
    step: "03",
    icon:  Sparkles,
    color: "text-violet-400",
    bg:    "bg-violet-500/10 border-violet-500/20",
    title: "Match & Dominate",
    desc:  "Get matched with wallets that complement your strengths. Build your squad and enter the Arena.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <Navbar>
        <Link
          href="/command-center"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-emerald-400 border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 transition-all"
        >
          Command Center
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Navbar>

      {/* ── Ambient background ─────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(16,185,129,1) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Glow blobs */}
        <div className="absolute top-1/4 left-1/4 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/8 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 h-[400px] w-[400px] rounded-full bg-violet-500/6 blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-cyan-500/5 blur-[80px]" />
      </div>

      <main className="relative">

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* HERO                                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="flex min-h-screen flex-col items-center justify-center px-4 pt-20 pb-16 text-center">

          {/* Tag */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-4 py-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-widest">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            The On-Chain Matchmaking Engine · Solana
          </div>

          {/* Headline */}
          <h1 className="mx-auto max-w-4xl text-5xl font-black leading-[1.07] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-br from-emerald-300 via-emerald-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(16,185,129,0.4)]">
              Find Your Perfect
            </span>
            <br />
            <span className="text-slate-100">Squad on Solana</span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-xl text-base text-slate-400 leading-relaxed sm:text-lg">
            Match with verified devs, whales, and early adopters. Score
            trustworthiness and build your dream team using real on-chain data.
          </p>

          {/* CTA cluster */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Web3LoginButton size="lg" />
            <Link
              href="/command-center"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/50 px-6 py-4 text-sm font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition-all backdrop-blur-xl"
            >
              View Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-5 text-xs text-slate-600">
            No email required · Sign in with Phantom · Your keys, your identity
          </p>

          {/* Trust strip */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-600">
            {["Powered by Solana", "Secured by Supabase", "PKCE Auth", "Non-custodial"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                {t}
              </span>
            ))}
          </div>

          {/* Scroll indicator */}
          <div className="mt-20 flex flex-col items-center gap-2 opacity-40">
            <div className="h-8 w-5 rounded-full border border-slate-700 flex items-start justify-center pt-1.5">
              <div className="h-1.5 w-1 rounded-full bg-slate-400 animate-bounce" />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STATS STRIP                                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="border-y border-slate-800/60 bg-slate-900/30 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-4 py-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-0.5 text-center">
                  <span className="text-2xl font-black text-emerald-400 tabular-nums">
                    {s.value}
                  </span>
                  <span className="text-[11px] uppercase tracking-widest text-slate-600">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* FEATURES                                                           */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:py-32">
          <div className="text-center mb-14">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-500">
              Core Features
            </p>
            <h2 className="text-3xl font-black text-slate-100 sm:text-4xl">
              Everything you need to{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                dominate on-chain
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-slate-500 text-sm leading-relaxed">
              Three powerful systems working together to analyse, rank, and match
              the sharpest wallets in the Pump.fun ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl p-6 transition-all duration-300 ${f.border} group`}
                >
                  {/* Card glow */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${f.glow} via-transparent to-transparent pointer-events-none`} />

                  {/* Badge */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl ${f.iconBg}`}>
                      <Icon className={`h-5 w-5 ${f.iconColor}`} />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${f.iconColor} opacity-70`}>
                      {f.badge}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-black text-slate-100 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5">{f.desc}</p>

                  {/* Bullets */}
                  <ul className="space-y-2">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-slate-400">
                        <div className={`h-1 w-1 rounded-full flex-shrink-0 ${f.iconColor}`} />
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* Bottom border flash on hover */}
                  <div className={`absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent ${f.iconColor.replace("text-", "via-")} to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500`} />
                </div>
              );
            })}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* HOW IT WORKS                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="border-t border-slate-800/50 bg-slate-900/20">
          <div className="mx-auto max-w-5xl px-4 py-24 sm:py-32">
            <div className="text-center mb-14">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-500">
                How It Works
              </p>
              <h2 className="text-3xl font-black text-slate-100 sm:text-4xl">
                From wallet to squad in{" "}
                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  three steps
                </span>
              </h2>
            </div>

            <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Connector line (desktop only) */}
              <div className="absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-emerald-500/30 via-cyan-500/30 to-violet-500/30 hidden md:block pointer-events-none" />

              {HOW_IT_WORKS.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="relative flex flex-col items-center text-center p-6">
                    {/* Step icon */}
                    <div className={`relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border ${step.bg}`}>
                      <Icon className={`h-7 w-7 ${step.color}`} />
                      <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border border-slate-700 text-[9px] font-black text-slate-500">
                        {step.step}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-100 mb-2">{step.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* FINAL CTA                                                          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="border-t border-slate-800/50">
          <div className="mx-auto max-w-3xl px-4 py-24 sm:py-32 text-center">

            {/* Glow behind the CTA card */}
            <div className="relative mx-auto max-w-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-cyan-500/8 to-violet-500/10 rounded-3xl blur-2xl" />

              <div className="relative rounded-3xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl p-10 sm:p-14">
                <div className="mb-4 inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <Logo className="h-10 w-10" />
                </div>

                <h2 className="text-3xl font-black text-slate-100 mb-3 sm:text-4xl">
                  Ready to find your{" "}
                  <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    squad?
                  </span>
                </h2>

                <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-md mx-auto">
                  Connect your Phantom wallet and let your on-chain history speak for itself.
                  It takes 10 seconds.
                </p>

                <div className="flex flex-col items-center gap-3">
                  <Web3LoginButton size="lg" />
                  <p className="text-xs text-slate-700 mt-1">
                    No registration · Non-custodial · Open source
                  </p>
                </div>

                {/* Social proof micro-strip */}
                <div className="mt-8 pt-8 border-t border-slate-800/70 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
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
        <footer className="border-t border-slate-800/50 py-8">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <Logo className="h-5 w-5" />
              <span className="font-semibold text-slate-600">Pump Match</span>
              <span>· Season 1 · Powered by Solana</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/docs" className="hover:text-slate-400 transition-colors">Docs</Link>
              <a href="https://x.com/PumpMatch" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">X / Twitter</a>
              <Link href="/command-center" className="hover:text-emerald-500 transition-colors text-emerald-700">Launch App</Link>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}
