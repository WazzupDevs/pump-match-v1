"use client";

import { Suspense, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSquadAuth } from "@/components/providers/SquadProvider";
import {
  LinkTwitterButton,
  TwitterLinkSync,
} from "@/components/auth/LinkTwitterButton";
import { TrustBadge } from "@/components/arena/trust-badge";
import {
  Wallet,
  Shield,
  Trophy,
  Users,
  TrendingUp,
  ChevronRight,
  Copy,
  CheckCheck,
  ExternalLink,
  Activity,
  Coins,
  BarChart3,
  Swords,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  BadgeCheck,
  AlertCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function shortAddress(addr: string | null) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Stats Bar
// ─────────────────────────────────────────────────────────────────────────────

interface StatItem {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const QUICK_STATS: StatItem[] = [
  { label: "SOL Balance", value: "4.20 SOL",  icon: Coins,      color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { label: "Trust Score",  value: "750 pts",   icon: Shield,     color: "text-cyan-400",    bg: "bg-cyan-500/10"    },
  { label: "Arena Rank",   value: "#42",        icon: Trophy,     color: "text-amber-400",   bg: "bg-amber-500/10"   },
  { label: "Win Rate",     value: "67%",        icon: TrendingUp, color: "text-violet-400",  bg: "bg-violet-500/10"  },
];

function StatChip({ label, value, icon: Icon, color, bg }: StatItem) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl flex-1 min-w-[140px] hover:border-slate-600/70 transition-all group cursor-default">
      <div className={`p-2 rounded-xl ${bg} shrink-0`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest truncate">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card: Web3 & Social Identity
// ─────────────────────────────────────────────────────────────────────────────

function IdentityCard({
  walletAddress,
  twitterHandle,
}: {
  walletAddress: string | null;
  twitterHandle: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    if (!walletAddress) return;
    void navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [walletAddress]);

  return (
    <div className="relative overflow-hidden p-6 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl hover:border-emerald-500/25 transition-all duration-300">
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/6 via-transparent to-cyan-500/4 pointer-events-none" />

      {/* Section header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 rounded-xl bg-emerald-500/10">
          <Wallet className="h-4 w-4 text-emerald-400" />
        </div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Web3 &amp; Social Identity
        </h2>
      </div>

      {/* Wallet row */}
      <div className="mb-5">
        <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">
          Solana Wallet
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-emerald-400 text-base font-bold">
            {shortAddress(walletAddress)}
          </span>
          <button
            onClick={copy}
            className="text-slate-600 hover:text-slate-300 transition-colors"
            title={copied ? "Copied!" : "Copy address"}
          >
            {copied ? (
              <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        {walletAddress && (
          <p className="mt-1 text-[10px] text-slate-600 font-mono truncate">
            {walletAddress}
          </p>
        )}
      </div>

      {/* Trust tier */}
      <div className="mb-6">
        <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">
          Trust Tier
        </p>
        <TrustBadge score={750} tier="Elite" />
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800/70 pt-5">
        {twitterHandle ? (
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <BadgeCheck className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                X Account Verified
              </p>
              <p className="text-sm font-bold text-sky-400 mt-0.5">
                @{twitterHandle}
              </p>
            </div>
            <div className="ml-auto">
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                +50 pts
              </span>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-2 mb-4 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">
                Link your X account to unlock your full Trust Score and
                appear in verified leaderboards.
              </p>
            </div>
            <LinkTwitterButton />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card: Wallet Analysis
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_TOKENS = [
  { symbol: "BONK",   change: +41.2, value: "$420", positive: true  },
  { symbol: "WIF",    change:  -8.4, value: "$210", positive: false },
  { symbol: "POPCAT", change: +22.1, value: "$315", positive: true  },
  { symbol: "FWOG",   change:  -3.1, value: "$88",  positive: false },
];

const MOCK_METRICS = [
  { label: "Token Diversity", value: "14 assets"   },
  { label: "Closed Positions", value: "87 trades"  },
  { label: "Avg Hold Time",   value: "6.4 hours"  },
  { label: "Rug Magnet",      value: "Low risk"    },
];

function WalletAnalysisCard() {
  return (
    <div className="relative overflow-hidden p-6 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl hover:border-cyan-500/25 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
          </div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Wallet Analysis
          </h2>
        </div>
        <span className="text-[10px] text-slate-600 bg-slate-800/60 border border-slate-700/40 px-2.5 py-1 rounded-full">
          Mock Preview
        </span>
      </div>

      {/* PnL Hero */}
      <div className="mb-5 p-4 bg-slate-800/50 rounded-xl border border-slate-700/30">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
          Estimated PnL (30d)
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-emerald-400">+$1,337</span>
          <div className="flex items-center gap-0.5 text-emerald-500 text-xs font-semibold">
            <ArrowUpRight className="h-3.5 w-3.5" />
            18.4%
          </div>
        </div>
      </div>

      {/* Quick metrics grid */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {MOCK_METRICS.map((m) => (
          <div key={m.label} className="p-3 bg-slate-800/30 rounded-xl border border-slate-700/20">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">{m.label}</p>
            <p className="text-xs font-semibold text-slate-300">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Token positions */}
      <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">
        Top Positions
      </p>
      <div className="space-y-1.5 mb-5">
        {MOCK_TOKENS.map((t) => (
          <div
            key={t.symbol}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-700/20"
          >
            <span className="text-xs font-mono font-semibold text-slate-300">
              {t.symbol}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500">{t.value}</span>
              <span
                className={`text-[11px] font-bold flex items-center gap-0.5 ${
                  t.positive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {t.positive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(t.change)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5 text-cyan-400 text-sm font-semibold hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all group">
        Full Wallet Analysis
        <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card: Arena Leaderboard
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_LEADERBOARD = [
  { rank: 1,  handle: "@crypto_apex",  score: 2840, isUser: false },
  { rank: 2,  handle: "@solana_king",  score: 2611, isUser: false },
  { rank: 3,  handle: "@pump_degen",   score: 2450, isUser: false },
  { rank: 42, handle: "You",           score: 750,  isUser: true  },
];

function ArenaCard() {
  return (
    <div className="relative overflow-hidden p-6 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl hover:border-amber-500/25 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <Swords className="h-4 w-4 text-amber-400" />
          </div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Arena
          </h2>
        </div>
        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
          Season 1 Live
        </span>
      </div>

      {/* Rank hero */}
      <div className="mb-5 p-4 bg-slate-800/50 rounded-xl border border-amber-500/15">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
          Your Global Rank
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-amber-400">#42</span>
          <span className="text-xs text-slate-500">of 1,337 participants</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400 font-semibold">
          <ArrowUpRight className="h-3.5 w-3.5" />
          +14 positions this week
        </div>
      </div>

      {/* Mini leaderboard */}
      <div className="space-y-1.5 mb-5">
        {MOCK_LEADERBOARD.map((entry, i) => {
          const medalColors = ["text-amber-400", "text-slate-400", "text-orange-500"];
          return (
            <div
              key={entry.rank}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors ${
                entry.isUser
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : "bg-slate-800/30 border border-transparent"
              }`}
            >
              <span
                className={`font-black w-6 text-center ${
                  entry.isUser
                    ? "text-amber-400"
                    : (medalColors[i] ?? "text-slate-600")
                }`}
              >
                #{entry.rank}
              </span>
              <span
                className={`flex-1 font-semibold ${
                  entry.isUser ? "text-amber-300" : "text-slate-400"
                }`}
              >
                {entry.handle}
              </span>
              <span
                className={`font-bold tabular-nums ${
                  entry.isUser ? "text-amber-400" : "text-slate-500"
                }`}
              >
                {entry.score.toLocaleString()} pts
              </span>
            </div>
          );
        })}
      </div>

      <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-sm font-black hover:from-amber-400 hover:to-orange-400 transition-all hover:shadow-lg hover:shadow-amber-500/25">
        <Swords className="h-4 w-4" />
        Enter the Arena
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card: Squads
// ─────────────────────────────────────────────────────────────────────────────

interface Member {
  handle: string;
  role: string;
  dot: string;
  isUser?: boolean;
}

const MOCK_SQUAD_MEMBERS: Member[] = [
  { handle: "@pump_legend",  role: "Dev",       dot: "bg-emerald-400" },
  { handle: "@diamond_paws", role: "Whale",     dot: "bg-cyan-400"    },
  { handle: "@art3mis_sol",  role: "Artist",    dot: "bg-violet-400"  },
  { handle: "@You",          role: "Marketing", dot: "bg-amber-400", isUser: true },
];

function SquadsCard() {
  return (
    <div className="relative overflow-hidden p-6 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl hover:border-violet-500/25 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-500/10">
            <Users className="h-4 w-4 text-violet-400" />
          </div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Squad
          </h2>
        </div>
        <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full">
          4 / 5 Members
        </span>
      </div>

      {/* Squad name */}
      <div className="mb-5">
        <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">
          Current Squad
        </p>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Diamond Paws
          </span>
          <Sparkles className="h-5 w-5 text-violet-400 shrink-0" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-600 uppercase tracking-widest">
            Squad Capacity
          </span>
          <span className="text-[10px] text-slate-500">4/5</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"
            style={{ width: "80%" }}
          />
        </div>
      </div>

      {/* Member list */}
      <div className="space-y-1.5 mb-5">
        {MOCK_SQUAD_MEMBERS.map((m) => (
          <div
            key={m.handle}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs ${
              m.isUser
                ? "bg-violet-500/10 border border-violet-500/20"
                : "bg-slate-800/30 border border-transparent"
            }`}
          >
            <div className={`h-2 w-2 rounded-full shrink-0 ${m.dot}`} />
            <span
              className={`flex-1 font-semibold ${
                m.isUser ? "text-violet-300" : "text-slate-400"
              }`}
            >
              {m.handle}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-600">
              {m.role}
            </span>
          </div>
        ))}

        {/* Empty slot */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs border border-dashed border-slate-700/50 text-slate-700">
          <div className="h-2 w-2 rounded-full border border-dashed border-slate-700" />
          <span>Slot available — invite someone</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-violet-500/30 bg-violet-500/5 text-violet-400 text-xs font-bold hover:bg-violet-500/10 hover:border-violet-500/50 transition-all group">
          <ExternalLink className="h-3.5 w-3.5" />
          View Squad
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/30 text-slate-400 text-xs font-bold hover:border-slate-600 hover:text-slate-300 hover:bg-slate-800/60 transition-all">
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-9 w-9 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-slate-500 text-sm">Loading Command Center…</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner component — needs <Suspense> wrapper because of useSearchParams
// ─────────────────────────────────────────────────────────────────────────────

function CommandCenterInner() {
  const { ready, userId, walletAddress, twitterHandle } = useSquadAuth();
  const sp = useSearchParams();
  const router = useRouter();

  const authError = sp.get("error");
  const authErrorDesc = sp.get("error_description");

  if (!ready) return <LoadingState />;

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center p-8 max-w-sm">
          <div className="mb-6 inline-flex p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <Wallet className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Wallet Required</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Connect your Phantom wallet to access the Command Center.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Ambient background glows ──────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -left-32 h-[500px] w-[500px] rounded-full bg-emerald-500/4 blur-[100px]" />
        <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-cyan-500/4 blur-[100px]" />
        <div className="absolute bottom-1/3 left-1/4 h-72 w-72 rounded-full bg-violet-500/4 blur-[100px]" />
      </div>

      {/* ── Background sync — invisible, handles OAuth callback ──────────── */}
      <TwitterLinkSync />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] text-emerald-500 uppercase tracking-[0.2em] font-semibold">
                Live
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                Command Center
              </span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {shortAddress(walletAddress)}
              <span className="mx-2 text-slate-700">·</span>
              Season 1 Active
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <TrustBadge score={750} tier="Elite" />
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 text-slate-400 text-xs font-semibold hover:border-slate-600 hover:text-slate-200 transition-all">
              <Activity className="h-3.5 w-3.5" />
              Activity Log
            </button>
          </div>
        </div>

        {/* ── Error banner (from /auth/callback) ────────────────────────────── */}
        {authError && (
          <div className="flex items-start gap-3 p-4 bg-red-950/30 border border-red-700/40 rounded-2xl text-red-400 text-sm backdrop-blur-xl">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              <strong>Authentication error: </strong>
              {authErrorDesc ?? authError}
            </p>
          </div>
        )}

        {/* ── Quick stats ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          {QUICK_STATS.map((s) => (
            <StatChip key={s.label} {...s} />
          ))}
        </div>

        {/* ── 2×2 Dashboard grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <IdentityCard walletAddress={walletAddress} twitterHandle={twitterHandle} />
          <WalletAnalysisCard />
          <ArenaCard />
          <SquadsCard />
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <p className="text-center text-xs text-slate-800 pt-2">
          PumpMatch · Season 1 · Powered by Solana
        </p>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page export — Suspense required for useSearchParams in App Router
// ─────────────────────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CommandCenterInner />
    </Suspense>
  );
}
