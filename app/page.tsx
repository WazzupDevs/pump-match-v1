"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { Navbar } from "@/components/ui/navbar";
import { Web3LoginButton } from "@/components/auth/Web3LoginButton";
import { useSquadAuth } from "@/components/providers/SquadProvider";
import { supabase } from "@/lib/supabase/client";
import {
  BarChart3,
  ShieldCheck,
  Zap,
  ArrowRight,
  Star,
  TrendingUp,
  Radio,
  BadgeCheck,
  Award,
  Trophy,
  Crown,
  Medal,
  Search,
} from "lucide-react";

interface LeaderboardRow {
  rank: number;
  handle: string;
  score: number;
  tier: string;
}

const FEATURES = [
  {
    icon: BarChart3,
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
    topBar: "from-cyan-500/0 via-cyan-500/60 to-cyan-500/0",
    glow: "group-hover:shadow-cyan-500/10",
    badge: "Wallet Intelligence",
    title: "Understand Wallet Behavior",
    desc: "Turn raw on-chain activity into explainable signals. Surface style, quality, suspiciousness, and confidence-aware behavioral analysis.",
    bullets: [
      "Style, quality, and confidence breakdown",
      "Hold patterns, activity, and behavioral signals",
      "Explainable intelligence from observable history",
    ],
  },
  {
    icon: Radio,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    topBar: "from-amber-500/0 via-amber-500/60 to-amber-500/0",
    glow: "group-hover:shadow-amber-500/10",
    badge: "Token Intelligence",
    title: "Read Communities, Not Just Charts",
    desc: "Go beyond individual wallets. Analyze holder composition, churn, suspicious clusters, and community quality at scale.",
    bullets: [
      "Holder composition breakdown",
      "Suspicious cluster detection",
      "Community quality and fragility signals",
    ],
  },
  {
    icon: BadgeCheck,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
    topBar: "from-violet-500/0 via-violet-500/60 to-violet-500/0",
    glow: "group-hover:shadow-violet-500/10",
    badge: "Public Proof",
    title: "Establish Verifiable Public Proof",
    desc: "Turn explainable behavioral signals into a masked, shareable Wallet Intelligence Receipt that can travel across Solana.",
    bullets: [
      "Shareable Wallet Intelligence Receipt",
      "Explainable evidence and score context",
      "Portable proof built from behavior",
    ],
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: ShieldCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    title: "Connect Your Wallet",
    desc: "Sign in with Phantom in one click to analyze your behavior and unlock private product surfaces.",
  },
  {
    step: "02",
    icon: Zap,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    title: "Interpret Your Behavior",
    desc: "We transform on-chain activity into explainable outputs such as style, quality, suspiciousness, and confidence.",
  },
  {
    step: "03",
    icon: Award,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    title: "Build Public Proof",
    desc: "Turn those signals into a shareable receipt and reputation surface, forming the foundation for future coordination.",
  },
] as const;

const TIER_COLORS: Record<string, string> = {
  Legendary: "text-amber-400",
  Elite: "text-violet-400",
  Proven: "text-cyan-400",
  Contributor: "text-emerald-400",
  Newbie: "text-slate-400",
  EXILED: "text-red-500",
};

const RANK_ICONS = [Crown, Medal, Trophy];

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
        rank: i + 1,
        handle:
          (Array.isArray(r.profiles) ? r.profiles[0]?.x_handle : null) ??
          `Operator #${i + 1}`,
        score: Math.round(r.composite_score ?? 0),
        tier: r.tier ?? "Newbie",
      }));

      setRows(mapped);
      setLoading(false);
    }

    fetch();

    return () => {
      alive = false;
    };
  }, [limit]);

  return { rows, loading };
}

export default function Home() {
  const { ready, userId } = useSquadAuth();
  const isConnected = ready && !!userId;
  const { rows: leaderboard, loading: lbLoading } = useTopOperators(5);
  const router = useRouter();
  const [searchAddress, setSearchAddress] = useState("");

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchAddress.trim()) {
      router.push(`/profile/${searchAddress.trim()}`);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 font-sans text-slate-50">
      <Navbar>
        <Link
          href="/command-center"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/15"
        >
          Launch App
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Navbar>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
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

      <main id="main-content" className="relative">
        <section className="flex min-h-[88svh] flex-col items-center justify-center px-4 pt-28 pb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Behavioral Intelligence · Solana
          </div>

          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-black leading-[0.95] tracking-tighter sm:text-5xl lg:text-6xl">
            <span
              className="bg-linear-to-br from-emerald-300 via-emerald-400 to-cyan-400 bg-clip-text text-transparent"
              style={{ filter: "drop-shadow(0 0 28px rgba(16,185,129,0.22))" }}
            >
              Behavioral Intelligence
            </span>
            <br />
            <span className="text-slate-100">for Solana</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-slate-400 sm:text-lg sm:leading-8">
            PumpMatch turns raw on-chain activity into explainable wallet,
            token, and community intelligence building the foundation for
            reputation and future high-signal coordination.
          </p>

          {/* Wallet search bar */}
          <form
            onSubmit={handleAnalyze}
            className="mt-8 w-full max-w-md"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-900/50 backdrop-blur-xl px-4 py-3 transition-[border-color,box-shadow] duration-200 focus-within:border-emerald-500/40 focus-within:shadow-[0_0_22px_rgba(16,185,129,0.12)]">
              <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <input
                type="text"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                placeholder="Enter a Solana wallet address"
                className="min-w-0 flex-1 bg-transparent font-mono text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                spellCheck={false}
                autoComplete="off"
                aria-label="Solana wallet address to analyze"
              />
              <button
                type="submit"
                disabled={!searchAddress.trim()}
                className="shrink-0 rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-bold text-slate-900 transition-[background-color,transform] duration-200 hover:bg-emerald-400 active:scale-95 motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Analyze
              </button>
            </div>
          </form>

          {/* Secondary: connect / go to Command Center */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-xs text-slate-600">
              {isConnected ? "Welcome back" : "Or connect your wallet"}
            </p>
            {isConnected ? (
              <Link
                href="/command-center"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2 text-sm font-bold text-emerald-300 transition-[background-color,border-color,box-shadow] duration-200 hover:bg-emerald-500/15 hover:border-emerald-500/50 hover:shadow-[0_0_16px_rgba(16,185,129,0.12)] active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Enter Command Center
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <Web3LoginButton size="default" />
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-600">
            {[
              "Explainable Signals",
              "Confidence-Aware Outputs",
              "Behavior Over Balance",
              "Future Coordination Layer",
            ].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-emerald-700" aria-hidden="true" />
                {t}
              </span>
            ))}
          </div>

          <div className="mt-14 opacity-30 motion-reduce:hidden">
            <div className="mx-auto flex h-10 w-6 items-start justify-center rounded-full border border-slate-700 pt-2">
              <div className="h-2 w-1 rounded-full bg-slate-400 animate-bounce motion-reduce:animate-none" />
            </div>
          </div>
        </section>

        <section className="border-y border-slate-800/60">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:py-28">
            <div className="mb-10 text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-amber-500">
                Public Signals
              </p>
              <h2 className="text-3xl font-black text-slate-100 sm:text-4xl">
                Global Arena{" "}
                <span className="bg-linear-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Preview
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-500">
                A live look at public operators ranked by behavioral reputation
                signals and visible score surfaces.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0" />

              <div className="grid grid-cols-[3rem_1fr_5rem_6rem] items-center border-b border-slate-800/70 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 sm:grid-cols-[3.5rem_1fr_6rem_7rem]">
                <span>#</span>
                <span>Operator</span>
                <span className="text-right">Score</span>
                <span className="text-right">Tier</span>
              </div>

              {lbLoading ? (
                <div className="px-5 py-10 text-center">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                  <p className="mt-3 text-xs text-slate-600">
                    Loading arena preview…
                  </p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-600">
                  No public arena data yet. Be the first to analyze and appear.
                </div>
              ) : (
                leaderboard.map((entry) => {
                  const RankIcon = RANK_ICONS[entry.rank - 1];
                  const rankColors = [
                    "text-amber-400",
                    "text-slate-300",
                    "text-amber-600",
                  ];

                  return (
                    <div
                      key={entry.rank}
                      className="grid grid-cols-[3rem_1fr_5rem_6rem] items-center border-b border-slate-800/40 px-5 py-3.5 transition-colors hover:bg-slate-800/30 last:border-b-0 sm:grid-cols-[3.5rem_1fr_6rem_7rem]"
                    >
                      <span className="flex items-center">
                        {RankIcon ? (
                          <RankIcon
                            className={`h-4 w-4 ${rankColors[entry.rank - 1]}`}
                          />
                        ) : (
                          <span className="text-sm font-bold tabular-nums text-slate-600">
                            {entry.rank}
                          </span>
                        )}
                      </span>

                      <span className="truncate text-sm font-semibold text-slate-200">
                        {entry.handle.startsWith("Operator")
                          ? entry.handle
                          : `@${entry.handle}`}
                      </span>

                      <span className="text-right text-sm font-bold tabular-nums text-emerald-400">
                        {entry.score}
                      </span>

                      <span
                        className={`text-right text-xs font-bold uppercase tracking-wider ${
                          TIER_COLORS[entry.tier] ?? "text-slate-500"
                        }`}
                      >
                        {entry.tier}
                      </span>
                    </div>
                  );
                })
              )}

              <div className="flex items-center justify-between border-t border-slate-800/70 px-5 py-3">
                <span className="text-[10px] uppercase tracking-widest text-slate-700">
                  Season 1 · Solana Mainnet
                </span>
                <Link
                  href="/command-center"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500 transition-colors hover:text-amber-400"
                >
                  Explore Arena
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-28 sm:py-36">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-emerald-500">
              Core Loop
            </p>
            <h2 className="text-2xl font-black whitespace-normal text-slate-100 sm:text-4xl lg:text-5xl">
              <span className="inline-block">Analyze&nbsp;</span>
              <span className="inline-block text-slate-500">&rarr;</span>
              <span className="inline-block">&nbsp;</span>
              <span className="inline-block bg-linear-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Interpret
              </span>
              <span className="inline-block">&nbsp;</span>
              <span className="inline-block text-slate-500">&rarr;</span>
              <span className="inline-block">&nbsp;</span>
              <span className="inline-block bg-linear-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Prove
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-slate-500">
              Three connected systems built to surface behavioral intelligence,
              translate it into explainable signals, and turn it into public-safe
              proof.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;

              return (
                <div
                  key={f.title}
                  className={`group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/50 p-7 backdrop-blur-xl transition-colors duration-300 hover:border-slate-600/70 hover:shadow-xl ${f.glow}`}
                >
                  <div
                    className={`absolute inset-x-0 top-0 h-px bg-linear-to-r ${f.topBar}`}
                  />

                  <div className="mb-5 flex items-center justify-between">
                    <div
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.iconBg}`}
                    >
                      <Icon className={`h-6 w-6 ${f.iconColor}`} />
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest ${f.iconColor} opacity-60`}
                    >
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="mb-3 text-xl font-black leading-tight text-slate-100">
                    {f.title}
                  </h3>
                  <p className="mb-6 text-sm leading-relaxed text-slate-500">
                    {f.desc}
                  </p>

                  <ul className="space-y-2.5">
                    {f.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-center gap-2.5 text-xs text-slate-400"
                      >
                        <span
                          className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${f.iconBg.replace(
                            "/10",
                            "/60"
                          )}`}
                        />
                        {b}
                      </li>
                    ))}
                  </ul>

                  <div
                    className={`absolute inset-x-0 bottom-0 h-0.5 scale-x-0 origin-left bg-linear-to-r ${f.topBar} transition-transform duration-500 group-hover:scale-x-100`}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-slate-800/50 bg-slate-900/20">
          <div className="mx-auto max-w-5xl px-4 py-28 sm:py-36">
            <div className="mb-16 text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-cyan-500">
                How It Works
              </p>
              <h2 className="text-3xl font-black text-slate-100 sm:text-4xl">
                Up and running in{" "}
                <span className="bg-linear-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  three steps
                </span>
              </h2>
            </div>

            <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="pointer-events-none absolute top-9 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] hidden h-px bg-linear-to-r from-emerald-500/25 via-cyan-500/25 to-violet-500/25 md:block" />

              {HOW_IT_WORKS.map((s) => {
                const Icon = s.icon;

                return (
                  <div
                    key={s.step}
                    className="relative flex flex-col items-center px-4 py-6 text-center"
                  >
                    <div
                      className={`relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border ${s.bg}`}
                    >
                      <Icon className={`h-7 w-7 ${s.color}`} />
                      <span className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-[9px] font-black text-slate-500">
                        {s.step}
                      </span>
                    </div>
                    <h3 className="mb-2 text-base font-bold text-slate-100">
                      {s.title}
                    </h3>
                    <p className="max-w-xs text-sm leading-relaxed text-slate-500">
                      {s.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-800/50">
          <div className="mx-auto max-w-3xl px-4 py-28 text-center sm:py-36">
            <div className="relative mx-auto max-w-2xl">
              <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-linear-to-r from-emerald-500/10 via-cyan-500/8 to-violet-500/10 blur-2xl" />

              <div className="relative rounded-3xl border border-slate-700/50 bg-slate-900/60 p-10 backdrop-blur-xl sm:p-14">
                <div className="mb-5 inline-flex rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <Logo className="h-10 w-10" />
                </div>

                <h2 className="mb-4 text-3xl leading-tight font-black text-slate-100 sm:text-4xl">
                  Start with{" "}
                  <span className="bg-linear-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    Intelligence.
                  </span>
                </h2>

                <p className="mx-auto mb-9 max-w-md text-sm leading-relaxed text-slate-400">
                  Analyze a wallet, interpret real behavior, and explore the
                  system that turns on-chain activity into reputation and future
                  coordination.
                </p>

                <div className="flex flex-col items-center gap-3">
                  {isConnected ? (
                    <Link
                      href="/command-center"
                      className="group inline-flex items-center gap-2.5 rounded-2xl bg-emerald-500 px-9 py-4 text-lg font-black text-slate-900 transition-[background-color,box-shadow,transform] duration-200 hover:bg-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/40 active:scale-95 motion-reduce:active:scale-100"
                    >
                      Go to Command Center
                      <span className="text-xl">🚀</span>
                    </Link>
                  ) : (
                    <Web3LoginButton size="lg" />
                  )}

                  <p className="mt-1 text-xs text-slate-700">
                    No registration · Non-custodial · Open source
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-5 border-t border-slate-800/70 pt-8 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Star className="h-3 w-3 text-amber-500" />
                    Built for Solana operators
                  </span>
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3 text-emerald-600" />
                    Wallet, token, and community intelligence
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

        <footer className="border-t border-slate-800/50 py-10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 text-xs text-slate-700 sm:flex-row">
            <div className="flex items-center gap-2">
              <Logo className="h-5 w-5" />
              <span className="font-semibold text-slate-600">PumpMatch</span>
              <span className="hidden sm:inline">
                · Behavioral Intelligence for Solana
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://x.com/PumpMatch"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-slate-400"
              >
                X / Twitter
              </a>
              <Link
                href="/command-center"
                className="text-emerald-700 transition-colors hover:text-emerald-500"
              >
                Launch App →
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}