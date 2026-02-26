"use client";

import { motion } from "framer-motion";
import { Crown, Trophy, Medal, ShieldCheck } from "lucide-react";
import type { EliteAgent } from "@/app/actions/arena";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function formatAddress(address: string) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function generateAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

// ──────────────────────────────────────────────────────────────
// Rank Icon
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
        <Trophy className="h-4 w-4 text-slate-700" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600 shadow-lg shadow-orange-500/40 ring-2 ring-orange-400/30">
        <Medal className="h-4 w-4 text-orange-100" />
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
// Card Style
// ──────────────────────────────────────────────────────────────

function getCardStyle(rank: number): string {
  if (rank === 1)
    return "scale-[1.02] border-yellow-400/50 bg-gradient-to-br from-yellow-500/10 to-transparent shadow-[0_0_30px_-5px_rgba(250,204,21,0.2)]";
  if (rank === 2)
    return "border-slate-300/40 bg-gradient-to-br from-slate-400/5 to-transparent shadow-[0_0_20px_-5px_rgba(148,163,184,0.15)]";
  if (rank === 3)
    return "border-orange-400/40 bg-gradient-to-br from-orange-500/5 to-transparent shadow-[0_0_20px_-5px_rgba(251,146,60,0.15)]";
  return "border-slate-700/40 bg-slate-950/70 hover:border-slate-600/60 hover:bg-slate-900/70";
}

// ──────────────────────────────────────────────────────────────
// Agent Card
// ──────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: EliteAgent;
  index: number;
}

export function AgentCard({ agent, index }: AgentCardProps) {
  const displayScore = Math.min(98, agent.trustScore + 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: "easeOut",
        delay: index * 0.06,
      }}
      className={`relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border backdrop-blur-md p-3 sm:p-4 md:p-5 transition-all duration-300 ${getCardStyle(agent.rank)}`}
    >
      {/* Identity row: Rank + Avatar + Info */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 border-b border-slate-800/50 pb-3 sm:border-b-0 sm:pb-0">
        <RankIcon rank={agent.rank} />

        <div
          className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0 ring-2 ring-white/10"
          style={{ backgroundColor: generateAvatarColor(agent.username) }}
        >
          {agent.username.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-100 truncate">
              {agent.username}
            </span>
            {agent.identityState === "VERIFIED" && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-600 font-mono">
            {formatAddress(agent.address)}
          </span>
        </div>
      </div>

      {/* Trust Score + Network Bonus */}
      <div className="grid grid-cols-2 gap-2 sm:block sm:text-right flex-shrink-0 sm:pl-2">
        <div className="bg-slate-800/50 rounded-lg px-3 py-2.5 sm:bg-transparent sm:p-0 sm:rounded-none">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 sm:hidden">
            Trust Score
          </p>
          <span
            className={`text-lg sm:text-2xl font-black tabular-nums tracking-tighter leading-none ${
              displayScore >= 80
                ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.45)]"
                : displayScore >= 50
                  ? "text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.25)]"
                  : "text-rose-400"
            }`}
          >
            {displayScore}
          </span>
          <p className="hidden sm:block text-[8px] uppercase tracking-[0.15em] text-slate-600 mt-0.5">
            Trust
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-lg px-3 py-2.5 sm:bg-transparent sm:p-0 sm:rounded-none">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 sm:hidden">
            Network
          </p>
          <p className="text-sm font-mono text-emerald-400 sm:text-[9px] font-bold sm:mt-0.5 animate-pulse">
            +5 Bonus
          </p>
        </div>
      </div>

      {/* Rank 1 ambient glow */}
      {agent.rank === 1 && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-400/[0.03] via-transparent to-yellow-400/[0.03] pointer-events-none" />
      )}
    </motion.div>
  );
}
