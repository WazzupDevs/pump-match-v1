"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSquadAuth } from "@/components/providers/SquadProvider";
import { supabase } from "@/lib/supabase";
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
  ChevronLeft,
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
import { analyzeWallet, getNetworkMatches } from "@/app/actions/analyzeWallet";
import type { MatchProfile, WalletAnalysis } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Admin / God Mode
// Replace with your real base58 Solana address.
// Server-side RLS still enforces all real restrictions; this is UI-only.
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_WALLET = "CLsyuBeebutGdbxjur6fyb4RuPaQhj7u3vLXPvdMWiTv";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ValidTier =
  | "Newbie"
  | "Contributor"
  | "Proven"
  | "Elite"
  | "Legendary"
  | "EXILED";

const VALID_TIERS = new Set<string>([
  "Newbie",
  "Contributor",
  "Proven",
  "Elite",
  "Legendary",
  "EXILED",
]);

function toValidTier(raw: string | null | undefined): ValidTier {
  return raw && VALID_TIERS.has(raw) ? (raw as ValidTier) : "Newbie";
}

interface LeaderboardEntry {
  rank: number;
  handle: string;
  score: number;
  isUser: boolean;
}

interface Member {
  handle: string;
  role: string;
  dot: string;
  isUser?: boolean;
}

interface TrustData {
  score: number;
  tier: ValidTier;
}

interface ArenaData {
  myScore: number | null;
  myRank: number | null;
  totalParticipants: number;
  leaderboard: LeaderboardEntry[];
}

interface SquadData {
  projectName: string;
  projectId: string;
  memberCount: number;
  members: Member[];
}

interface DashboardData {
  trust: TrustData | null;
  arena: ArenaData | null;
  squad: SquadData | null; // null = not in an active squad
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (address normalization matches server action analyzeWallet.ts)
// ─────────────────────────────────────────────────────────────────────────────

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function normalizeWalletAddress(addr: string | null): string {
  if (!addr) return "";
  let normalized = addr.trim();
  if (normalized.startsWith("web3:solana:")) normalized = normalized.slice("web3:solana:".length);
  return normalized;
}

function shortAddress(addr: string | null) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Cycles through colours for squad member dots when role-based colour is unknown
const MEMBER_DOT_COLORS: string[] = [
  "bg-emerald-400",
  "bg-cyan-400",
  "bg-violet-400",
  "bg-amber-400",
  "bg-rose-400",
];

function formatHoldTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} hours`;
}

function rugRiskLabel(score: number): string {
  if (score >= 60) return "High risk";
  if (score >= 30) return "Medium risk";
  return "Low risk";
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Stats — dynamic values injected at render time
// ─────────────────────────────────────────────────────────────────────────────

interface StatItem {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

function buildStats(
  score: number | null,
  rank: number | null,
  isLoading: boolean,
  solBalance?: number | null,
): StatItem[] {
  const pending = isLoading ? "…" : "—";
  return [
    {
      label: "SOL Balance",
      value: solBalance != null ? `${solBalance.toFixed(2)}` : pending,
      icon: Coins,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Trust Score",
      value: score !== null ? `${score} pts` : pending,
      icon: Shield,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
    },
    {
      label: "Arena Rank",
      value: rank !== null ? `#${rank}` : pending,
      icon: Trophy,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Win Rate",
      value: "—",           // reserved for wallet analysis (future)
      icon: TrendingUp,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton shim — used for inline loading states inside cards
// ─────────────────────────────────────────────────────────────────────────────

function Skel({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-slate-800/70 animate-pulse rounded-lg ${className}`} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatChip
// ─────────────────────────────────────────────────────────────────────────────

function StatChip({ label, value, icon: Icon, color, bg }: StatItem) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl flex-1 min-w-[140px] hover:border-slate-600/70 transition-all group cursor-default">
      <div className={`p-2 rounded-xl ${bg} shrink-0`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest truncate">
          {label}
        </p>
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
  score,
  tier,
  isLoading,
}: {
  walletAddress: string | null;
  twitterHandle: string | null;
  score: number | null;
  tier: ValidTier | null;
  isLoading: boolean;
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
          {(() => {
            const normalized = normalizeWalletAddress(walletAddress);
            const isValid = BASE58_REGEX.test(normalized);
            if (!isValid) {
              return (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-slate-500 border border-slate-700/50 bg-slate-800/30 cursor-not-allowed"
                  title="Wallet address not available"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Public Profile
                </button>
              );
            }
            return (
              <Link
                href={`/profile/${normalized}`}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-colors"
                title="Open public profile"
              >
                <ExternalLink className="h-3 w-3" />
                View Public Profile
              </Link>
            );
          })()}
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
        {isLoading ? (
          <Skel className="h-5 w-24" />
        ) : (
          <TrustBadge score={score ?? 0} tier={tier ?? "Newbie"} />
        )}
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
                Link your X account to unlock your full Trust Score and appear
                in verified leaderboards.
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
// MOCK_TOKENS kept intact — real data wired via useEffect in CommandCenterInner
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_TOKENS = [
  { symbol: "BONK",   change: +41.2, value: "$420", positive: true  },
  { symbol: "WIF",    change:  -8.4, value: "$210", positive: false },
  { symbol: "POPCAT", change: +22.1, value: "$315", positive: true  },
  { symbol: "FWOG",   change:  -3.1, value: "$88",  positive: false },
];

const MOCK_METRICS = [
  { label: "Token Diversity",  value: "14 assets"  },
  { label: "Closed Positions", value: "87 trades"  },
  { label: "Avg Hold Time",    value: "6.4 hours"  },
  { label: "Rug Magnet",       value: "Low risk"   },
];

function WalletAnalysisCard({
  analysisData,
  matchCount,
  isAnalyzing,
  analysisError,
  onAnalyze,
  canAnalyze = true,
}: {
  analysisData: WalletAnalysis | null;
  matchCount: number;
  isAnalyzing: boolean;
  analysisError: string | null;
  onAnalyze: () => void;
  /** When false, analyze button is disabled (e.g. wallet address not yet available). */
  canAnalyze?: boolean;
}) {
  const hasData = analysisData !== null;
  const analyzeDisabled = !canAnalyze || isAnalyzing;

  const metrics = hasData
    ? [
        { label: "Token Diversity", value: `${analysisData.tokenDiversity} assets` },
        { label: "Closed Positions", value: analysisData.pumpStats ? `${analysisData.pumpStats.closedPositions} trades` : "—" },
        { label: "Avg Hold Time", value: analysisData.pumpStats ? formatHoldTime(analysisData.pumpStats.medianHoldTimeSeconds) : "—" },
        { label: "Rug Magnet", value: analysisData.pumpStats ? rugRiskLabel(analysisData.pumpStats.rugMagnetScore) : "—" },
      ]
    : MOCK_METRICS;

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
          {hasData ? (matchCount > 0 ? `${matchCount} Matches · Live` : "Live") : "Mock Preview"}
        </span>
      </div>

      {/* PnL Hero */}
      <div className="mb-5 p-4 bg-slate-800/50 rounded-xl border border-slate-700/30">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
          {hasData ? "SOL Balance" : "Estimated PnL (30d)"}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-emerald-400">
            {hasData ? `${analysisData.solBalance.toFixed(2)} SOL` : "+$1,337"}
          </span>
          <div className="flex items-center gap-0.5 text-emerald-500 text-xs font-semibold">
            {hasData ? <Shield className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
            {hasData ? `Score: ${analysisData.trustScore}/100` : "18.4%"}
          </div>
        </div>
      </div>

      {/* Quick metrics grid */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="p-3 bg-slate-800/30 rounded-xl border border-slate-700/20"
          >
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">
              {m.label}
            </p>
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

      {analysisError && (
        <p className="text-xs text-red-400 mb-2">{analysisError}</p>
      )}
      <button
        onClick={onAnalyze}
        disabled={analyzeDisabled}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5 text-cyan-400 text-sm font-semibold hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isAnalyzing ? "Analyzing…" : !canAnalyze ? "Loading wallet…" : hasData ? "Refresh Analysis" : "Full Wallet Analysis"}
        <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card: Arena Leaderboard
// ─────────────────────────────────────────────────────────────────────────────

function ArenaCard({
  arena,
  isGodMode,
  isLoading,
}: {
  arena: ArenaData | null;
  isGodMode: boolean;
  isLoading: boolean;
}) {
  const myRank = arena?.myRank ?? null;
  const totalParticipants = arena?.totalParticipants ?? 0;
  const leaderboard = arena?.leaderboard ?? [];

  // Restrict "Enter the Arena" to Proven+ tier; god mode bypasses.
  // (Tier check is done by the parent — here we just accept the flag.)
  const arenaLocked = !isGodMode && arena?.myScore === null;

  const medalColors = ["text-amber-400", "text-slate-400", "text-orange-500"];

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
        {isLoading ? (
          <Skel className="h-10 w-32 mt-1" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-amber-400">
              {myRank !== null ? `#${myRank}` : "—"}
            </span>
            {totalParticipants > 0 && (
              <span className="text-xs text-slate-500">
                of {totalParticipants.toLocaleString()} participants
              </span>
            )}
          </div>
        )}
        {!isLoading && (
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400 font-semibold">
            <ArrowUpRight className="h-3.5 w-3.5" />
            Season 1 Active
          </div>
        )}
      </div>

      {/* Mini leaderboard */}
      <div className="space-y-1.5 mb-5">
        {isLoading ? (
          <>
            <Skel className="h-8 w-full" />
            <Skel className="h-8 w-full" />
            <Skel className="h-8 w-full" />
            <Skel className="h-8 w-full" />
          </>
        ) : leaderboard.length > 0 ? (
          leaderboard.map((entry, i) => (
            <div
              key={`${entry.rank}-${entry.handle}`}
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
          ))
        ) : (
          <p className="text-xs text-slate-600 text-center py-4">
            No leaderboard data yet.
          </p>
        )}
      </div>

      <button
        disabled={arenaLocked}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-sm font-black hover:from-amber-400 hover:to-orange-400 transition-all hover:shadow-lg hover:shadow-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-amber-500 disabled:hover:to-orange-500 disabled:hover:shadow-none"
      >
        <Swords className="h-4 w-4" />
        {arenaLocked ? "Complete Profile to Enter" : "Enter the Arena"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card: Squads
// ─────────────────────────────────────────────────────────────────────────────

function SquadsCard({
  squad,
  isGodMode,
  isLoading,
  agentCandidates,
  matchesLoading,
  matchesError,
}: {
  squad: SquadData | null;
  isGodMode: boolean;
  isLoading: boolean;
  agentCandidates: MatchProfile[];
  matchesLoading: boolean;
  matchesError: string | null;
}) {
  const [radarExpanded, setRadarExpanded] = useState(false);
  const inSquad = squad !== null;
  const memberCount = squad?.memberCount ?? 0;
  const maxMembers = 5;
  const emptySlots = Math.max(0, maxMembers - memberCount);
  const capacityPct = Math.round((memberCount / maxMembers) * 100);

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
        {!isLoading && inSquad && (
          <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full">
            {memberCount} / {maxMembers} Members
          </span>
        )}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="space-y-3">
          <Skel className="h-7 w-40" />
          <Skel className="h-2 w-full" />
          <Skel className="h-9 w-full" />
          <Skel className="h-9 w-full" />
          <Skel className="h-9 w-full" />
        </div>
      )}

      {/* ── In a squad ── */}
      {!isLoading && inSquad && squad && (
        <>
          {/* Squad name */}
          <div className="mb-5">
            <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">
              Current Squad
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                {squad.projectName}
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
              <span className="text-[10px] text-slate-500">
                {memberCount}/{maxMembers}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-700"
                style={{ width: `${capacityPct}%` }}
              />
            </div>
          </div>

          {/* Member list */}
          <div className="space-y-1.5 mb-5">
            {squad.members.map((m) => (
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

            {/* Empty slots */}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs border border-dashed border-slate-700/50 text-slate-700"
              >
                <div className="h-2 w-2 rounded-full border border-dashed border-slate-700" />
                <span>Slot available — invite someone</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-violet-500/30 bg-violet-500/5 text-violet-400 text-xs font-bold hover:bg-violet-500/10 hover:border-violet-500/50 transition-all group">
              <ExternalLink className="h-3.5 w-3.5" />
              View Squad
            </button>
            <button
              disabled={!isGodMode && emptySlots === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/30 text-slate-400 text-xs font-bold hover:border-slate-600 hover:text-slate-300 hover:bg-slate-800/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite
            </button>
          </div>
        </>
      )}

      {/* ── Not in a squad ── */}
      {!isLoading && !inSquad && (
        <>
          <div className="mb-5 p-4 bg-slate-800/40 rounded-xl border border-slate-700/30 text-center">
            <Users className="h-8 w-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-400 mb-1">
              No Active Squad
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Team up with verified builders, whales, and early adopters to
              dominate launches together.
            </p>
          </div>

          {/* Agent Radar: only when not in squad */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                Agent Radar
              </span>
              <span className="text-[10px] text-slate-600 bg-slate-800/60 border border-slate-700/40 px-2 py-0.5 rounded-full">
                {matchesLoading
                  ? "Scanning…"
                  : agentCandidates.length > 0
                    ? `${agentCandidates.length} matches`
                    : "Run analysis"}
              </span>
            </div>
            {matchesError && (
              <p className="text-xs text-red-400 mb-2">{matchesError}</p>
            )}
            {agentCandidates.length === 0 && !matchesLoading && (
              <p className="text-xs text-slate-600 py-2">
                Run Wallet Analysis to populate Agent Radar.
              </p>
            )}
            {agentCandidates.length > 0 && (
              <>
                <div className="space-y-1.5 mb-2">
                  {(radarExpanded
                    ? agentCandidates.slice(0, 12)
                    : agentCandidates.slice(0, 3)
                  ).map((agent) => {
                    const addr = agent.address ?? agent.id;
                    const displayName =
                      agent.username && agent.username !== "Anon"
                        ? `@${agent.username}`
                        : shortAddress(addr ?? null);
                    const confidence =
                      typeof agent.matchConfidence === "number"
                        ? `${Math.round(agent.matchConfidence)}%`
                        : "Score —";
                    return (
                      <div
                        key={agent.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/30 border border-slate-700/20 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-300 truncate">
                              {displayName}
                            </span>
                            {typeof agent.endorsementCount === "number" &&
                              agent.endorsementCount > 0 && (
                                <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
                                  {agent.endorsementCount} endorsements
                                </span>
                              )}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {agent.matchReason || "—"}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono text-violet-400 shrink-0">
                          {confidence}
                        </span>
                        {addr && BASE58_REGEX.test(addr) ? (
                          <Link
                            href={`/profile/${addr}`}
                            className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-slate-600 border border-slate-700/50 bg-slate-800/30 cursor-not-allowed opacity-60"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {agentCandidates.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setRadarExpanded((e) => !e)}
                    className="text-[10px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    {radarExpanded ? "Show less" : "View all"}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-violet-500/30 bg-violet-500/5 text-violet-400 text-xs font-bold hover:bg-violet-500/10 hover:border-violet-500/50 transition-all">
              <Users className="h-3.5 w-3.5" />
              Browse Squads
            </button>
            <button
              disabled={!isGodMode}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/30 text-slate-400 text-xs font-bold hover:border-slate-600 hover:text-slate-300 hover:bg-slate-800/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title={!isGodMode ? "Trust score required to create a squad" : undefined}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Create Squad
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading screen
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

  const isGodMode = walletAddress === ADMIN_WALLET;

  const authError = sp.get("error");
  const authErrorDesc = sp.get("error_description");

  // ── Dashboard state ────────────────────────────────────────────────────────
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<WalletAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [previewMatches, setPreviewMatches] = useState<MatchProfile[]>([]);
  const [networkMatches, setNetworkMatches] = useState<MatchProfile[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  // ── Main data fetch ────────────────────────────────────────────────────────
  // Runs once when userId becomes available. Uses an `alive` guard to prevent
  // setting state on an unmounted component (stale-request protection).
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let alive = true;
    setIsLoading(true);
    setFetchError(null);

    const fetchDashboard = async () => {
      try {
        // ── Round 1: all independent queries in parallel ───────────────────
        const [myMetricsRes, top3Res, myMembershipRes, totalCountRes] =
          await Promise.all([
            // 1a. My trust score + tier
            supabase
              .from("trust_metrics")
              .select("composite_score, tier")
              .eq("user_id", userId)
              .maybeSingle(),

            // 1b. Top-3 for leaderboard (with x_handle from profiles)
            supabase
              .from("trust_metrics")
              .select("composite_score, user_id, profiles(x_handle)")
              .order("composite_score", { ascending: false })
              .limit(3),

            // 1c. My active squad membership (newest first; use project_id)
            supabase
              .from("squad_members")
              .select("project_id, squad_projects(project_name)")
              .eq("user_id", userId)
              .eq("status", "active")
              .order("joined_at", { ascending: false })
              .limit(1)
              .maybeSingle(),

            // 1d. Total participants for "of N participants" display
            supabase
              .from("trust_metrics")
              .select("*", { count: "exact", head: true }),
          ]);

        if (!alive) return;

        // ── Parse trust metrics ────────────────────────────────────────────
        const myScore = myMetricsRes.data?.composite_score ?? null;
        const trust: TrustData | null =
          myScore !== null
            ? { score: myScore, tier: toValidTier(myMetricsRes.data?.tier) }
            : null;

        // ── Parse my membership ────────────────────────────────────────────
        const membershipRow = myMembershipRes.data as {
          project_id: string;
          squad_projects: { project_name: string } | null;
        } | null;
        const projectId = membershipRow?.project_id ?? null;

        // ── Round 2: dependent queries in parallel ─────────────────────────
        const [rankRes, squadMembersRes] = await Promise.all([
          // 2a. Count wallets ranked above me → my rank = aboveMe + 1
          myScore !== null
            ? supabase
                .from("trust_metrics")
                .select("*", { count: "exact", head: true })
                .gt("composite_score", myScore)
            : Promise.resolve({ count: null, error: null }),

          // 2b. All active members of my squad (only if in one)
          projectId
            ? supabase
                .from("squad_members")
                .select("user_id, profiles(x_handle, role)")
                .eq("project_id", projectId)
                .eq("status", "active")
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (!alive) return;

        // ── Build arena data ───────────────────────────────────────────────
        const aboveMe = rankRes.count ?? null;
        const myRank = aboveMe !== null ? aboveMe + 1 : null;
        const totalParticipants = totalCountRes.count ?? 0;

        // Map top-3 rows to typed leaderboard entries
        type RawTopRow = {
          composite_score: number;
          user_id: string;
          profiles: { x_handle: string | null } | null;
        };
        const topEntries: LeaderboardEntry[] = (
          (top3Res.data ?? []) as unknown as RawTopRow[]
        ).map((row, i) => ({
          rank: i + 1,
          handle: row.profiles?.x_handle
            ? `@${row.profiles.x_handle}`
            : `Wallet ${i + 1}`,
          score: row.composite_score,
          isUser: row.user_id === userId,
        }));

        // Append "You" row if user is not already in the top 3
        const userInTop3 = topEntries.some((e) => e.isUser);
        const leaderboard: LeaderboardEntry[] = userInTop3
          ? topEntries
          : [
              ...topEntries,
              {
                rank: myRank ?? 0,
                handle: "You",
                score: myScore ?? 0,
                isUser: true,
              },
            ];

        // ── Build squad data ───────────────────────────────────────────────
        type RawMemberRow = {
          user_id: string;
          profiles: { x_handle: string | null; role: string | null } | null;
        };

        let squad: SquadData | null = null;

        if (membershipRow && projectId) {
          const projectName =
            membershipRow.squad_projects?.project_name ?? "Your Squad";
          const rawMembers = (
            (squadMembersRes.data ?? []) as unknown as RawMemberRow[]
          ).map((m, i) => ({
            handle: m.profiles?.x_handle
              ? `@${m.profiles.x_handle}`
              : `Member ${i + 1}`,
            role: m.profiles?.role ?? "Member",
            dot: MEMBER_DOT_COLORS[i % MEMBER_DOT_COLORS.length] ?? "bg-slate-400",
            isUser: m.user_id === userId,
          }));

          squad = {
            projectName,
            projectId,
            memberCount: rawMembers.length,
            members: rawMembers,
          };
        }

        if (!alive) return;

        setData({
          trust,
          arena: { myScore, myRank, totalParticipants, leaderboard },
          squad,
        });
      } catch (err: unknown) {
        if (!alive) return;
        const msg =
          err instanceof Error ? err.message : "Failed to load dashboard data.";
        setFetchError(msg);
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    void fetchDashboard();

    return () => {
      alive = false;
    };
  }, [userId]);

  // ── Wallet Analysis: user-triggered via "Full Wallet Analysis" button ─────
  const handleAnalyze = useCallback(async () => {
    if (!walletAddress || typeof walletAddress !== "string") {
      setAnalysisError("Wallet address is not ready yet. Please wait a moment or refresh.");
      return;
    }
    if (analysisLoading) return;
    const normalizedAddr = normalizeWalletAddress(walletAddress);
    if (!BASE58_REGEX.test(normalizedAddr)) {
      setAnalysisError("Invalid wallet address.");
      return;
    }
    setAnalysisLoading(true);
    setAnalysisError(null);
    setMatchesError(null);
    try {
      const result = await analyzeWallet(normalizedAddr);
      setAnalysisData(result.walletAnalysis);
      setPreviewMatches(result.matches);
      setMatchCount(result.matches.length);

      if (result.walletAnalysis.isRegistered) {
        setMatchesLoading(true);
        try {
          const profiles = await getNetworkMatches(
            result.walletAnalysis.address,
            result.walletAnalysis,
          );
          setNetworkMatches(profiles);
        } catch (networkErr) {
          const msg =
            networkErr instanceof Error ? networkErr.message : "Failed to load network matches";
          setMatchesError(msg);
          setNetworkMatches([]);
        } finally {
          setMatchesLoading(false);
        }
      } else {
        setNetworkMatches([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setAnalysisError(msg);
    } finally {
      setAnalysisLoading(false);
    }
  }, [walletAddress, analysisLoading]);

  const agentCandidates =
    networkMatches.length > 0 ? networkMatches : previewMatches;

  // ── Quick stats computed from real data ────────────────────────────────────
  const quickStats = buildStats(
    data?.trust?.score ?? null,
    data?.arena?.myRank ?? null,
    isLoading,
    analysisData?.solBalance ?? null,
  );

  // ── Auth gate ──────────────────────────────────────────────────────────────
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

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] text-emerald-500 uppercase tracking-[0.2em] font-semibold">
                {isGodMode ? "God Mode · Live" : "Live"}
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
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 text-slate-400 text-xs font-semibold hover:border-slate-600 hover:text-slate-200 transition-all"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            {isLoading ? (
              <Skel className="h-5 w-20" />
            ) : (
              <TrustBadge
                score={data?.trust?.score ?? 0}
                tier={data?.trust?.tier ?? "Newbie"}
              />
            )}
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 text-slate-400 text-xs font-semibold hover:border-slate-600 hover:text-slate-200 transition-all">
              <Activity className="h-3.5 w-3.5" />
              Activity Log
            </button>
          </div>
        </div>

        {/* ── Error banners ────────────────────────────────────────────────── */}
        {authError && (
          <div className="flex items-start gap-3 p-4 bg-red-950/30 border border-red-700/40 rounded-2xl text-red-400 text-sm backdrop-blur-xl">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              <strong>Authentication error: </strong>
              {authErrorDesc ?? authError}
            </p>
          </div>
        )}

        {fetchError && (
          <div className="flex items-start gap-3 p-4 bg-red-950/20 border border-red-800/30 rounded-2xl text-red-400 text-sm backdrop-blur-xl">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              <strong>Data fetch error: </strong>
              {fetchError}
            </p>
          </div>
        )}

        {/* ── Quick stats ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          {quickStats.map((s) => (
            <StatChip key={s.label} {...s} />
          ))}
        </div>

        {/* ── 2×2 Dashboard grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <IdentityCard
            walletAddress={walletAddress}
            twitterHandle={twitterHandle}
            score={data?.trust?.score ?? null}
            tier={data?.trust?.tier ?? null}
            isLoading={isLoading}
          />

          <WalletAnalysisCard
            analysisData={analysisData}
            matchCount={matchCount}
            isAnalyzing={analysisLoading}
            analysisError={analysisError}
            onAnalyze={handleAnalyze}
            canAnalyze={Boolean(walletAddress)}
          />

          <ArenaCard
            arena={data?.arena ?? null}
            isGodMode={isGodMode}
            isLoading={isLoading}
          />

          <SquadsCard
            squad={data?.squad ?? null}
            isGodMode={isGodMode}
            isLoading={isLoading}
            agentCandidates={agentCandidates}
            matchesLoading={matchesLoading}
            matchesError={matchesError}
          />
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
