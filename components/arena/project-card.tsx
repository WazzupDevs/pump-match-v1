"use client";

import { motion } from "framer-motion";
import {
  Crown,
  Trophy,
  Medal,
  Ghost,
  Droplets,
  TrendingUp,
} from "lucide-react";
import type { PowerSquadProject } from "@/app/actions/arena";
import { FounderBadge } from "@/components/arena/founder-badge";

// ──────────────────────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────────────────────

const mcFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 2,
});

function fmtMC(value: number | null): string {
  if (value == null || value <= 0) return "—";
  return mcFormatter.format(value);
}

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return "Never";
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ──────────────────────────────────────────────────────────────
// Rank Icon (inline, next to rank number for top 3)
// ──────────────────────────────────────────────────────────────

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 shadow-lg shadow-yellow-500/50 ring-2 ring-yellow-400/40">
        <Crown className="h-5 w-5 text-yellow-950" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 shadow-lg shadow-slate-400/40 ring-2 ring-slate-300/30">
        <Trophy className="h-4.5 w-4.5 text-slate-700" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600 shadow-lg shadow-orange-500/40 ring-2 ring-orange-400/30">
        <Medal className="h-4.5 w-4.5 text-orange-100" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-700/60 bg-slate-800/70">
      <span className="text-sm font-bold text-slate-400 tabular-nums">
        {rank}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Card Style — The Podium System
// ──────────────────────────────────────────────────────────────

function getCardStyle(rank: number): string {
  if (rank === 1)
    return "scale-[1.02] border-yellow-400/50 bg-gradient-to-br from-yellow-500/10 to-transparent shadow-[0_0_30px_-5px_rgba(250,204,21,0.2)]";
  if (rank === 2)
    return "border-slate-300/40 bg-gradient-to-br from-slate-400/5 to-transparent shadow-[0_0_20px_-5px_rgba(148,163,184,0.15)]";
  if (rank === 3)
    return "border-orange-400/40 bg-gradient-to-br from-orange-500/5 to-transparent shadow-[0_0_20px_-5px_rgba(251,146,60,0.15)]";
  return "border-slate-800/60 bg-slate-950/70 hover:border-slate-700/60 hover:bg-slate-900/70";
}

// ──────────────────────────────────────────────────────────────
// Project Card
// ──────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: PowerSquadProject;
  index: number;
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  const isGhost = project.status === "ghost";
  const isFounder = project.claim_tier === "founder";
  const rank = project.rank;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: "easeOut",
        delay: index * 0.06,
      }}
      className={`relative flex items-center gap-4 rounded-2xl border p-4 md:p-5 transition-all duration-300 ${
        isGhost
          ? "grayscale opacity-60 border-slate-800/30 bg-slate-950/30"
          : getCardStyle(rank)
      }`}
    >
      {/* ── Rank ── */}
      <RankIcon rank={rank} />

      {/* ── Project Icon / Ticker ── */}
      <div
        className={`h-11 w-11 rounded-xl flex items-center justify-center font-black shadow-md flex-shrink-0 ${
          isGhost
            ? "bg-slate-800/80 border border-slate-700/60 text-slate-600"
            : rank === 1
              ? "bg-gradient-to-br from-yellow-500/25 to-amber-600/15 border border-yellow-500/25 text-yellow-300"
              : rank <= 3
                ? "bg-gradient-to-br from-purple-500/20 to-amber-500/10 border border-purple-500/20 text-purple-200"
                : "bg-gradient-to-br from-purple-500/15 to-emerald-500/10 border border-purple-500/10 text-purple-300"
        }`}
      >
        {isGhost ? (
          <Ghost className="h-5 w-5" />
        ) : (
          <span className="text-[11px] leading-none tracking-tight">
            ${(project.symbol || project.name || "??").slice(0, 3)}
          </span>
        )}
      </div>

      {/* ── Info Column ── */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Name + Ticker + Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm font-bold truncate max-w-[160px] md:max-w-[220px] ${
              isGhost ? "text-slate-600" : "text-slate-100"
            }`}
          >
            {project.name}
          </span>
          <span
            className={`text-[10px] font-mono leading-none ${
              isGhost ? "text-slate-700" : "text-slate-500"
            }`}
          >
            ${project.symbol || "???"}
          </span>

          {/* Founder Badge */}
          {isFounder && !isGhost && <FounderBadge />}

          {/* Ghost Badge */}
          {isGhost && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider cursor-default"
              title="Liquidity critically low (<$1K)"
            >
              <Ghost className="h-3 w-3" />
              Ghost
            </span>
          )}
        </div>

        {/* Row 2: Metrics */}
        <div className="flex items-center gap-3 mt-1.5">
          <span
            className={`text-[10px] flex items-center gap-1 ${
              isGhost ? "text-slate-700" : "text-slate-500"
            }`}
          >
            <Droplets className="h-3 w-3 flex-shrink-0" />
            Liq: {fmtMC(project.liquidity_usd)}
          </span>
          <span
            className={`text-[10px] flex items-center gap-1 ${
              isGhost ? "text-slate-700" : "text-slate-500"
            }`}
          >
            <TrendingUp className="h-3 w-3 flex-shrink-0" />
            Vol: {fmtMC(project.volume_24h)}
          </span>
          <span
            className={`text-[10px] ${
              isGhost ? "text-slate-700" : "text-slate-600"
            }`}
          >
            {timeAgo(project.last_mc_update)}
          </span>
        </div>
      </div>

      {/* ── Market Cap (Right-Aligned Hero Number) ── */}
      <div className="text-right flex-shrink-0 pl-2">
        <span
          className={`text-xl font-black tabular-nums tracking-tight leading-none ${
            isGhost
              ? "text-slate-700"
              : project.last_valid_mc && project.last_valid_mc >= 1_000_000
                ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]"
                : project.last_valid_mc && project.last_valid_mc > 0
                  ? "text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.2)]"
                  : "text-slate-600"
          }`}
        >
          {fmtMC(project.last_valid_mc)}
        </span>
        <p
          className={`text-[8px] uppercase tracking-[0.15em] mt-1 ${
            isGhost ? "text-slate-700" : "text-slate-600"
          }`}
        >
          Market Cap
        </p>
      </div>

      {/* Rank 1 ambient glow overlay */}
      {rank === 1 && !isGhost && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-400/[0.03] via-transparent to-yellow-400/[0.03] pointer-events-none" />
      )}
    </motion.div>
  );
}
