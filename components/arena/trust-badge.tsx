"use client";

import { ShieldAlert, ShieldCheck, Shield, Skull } from "lucide-react";

interface TrustBadgeProps {
  score?: number;
  tier?: "Newbie" | "Contributor" | "Proven" | "Elite" | "Legendary" | "EXILED";
  className?: string;
}

export function TrustBadge({ score = 0, tier = "Newbie", className = "" }: TrustBadgeProps) {
  if (tier === "EXILED") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-red-950/40 text-red-500 border border-red-500/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider cursor-help animate-pulse ${className}`}
        title="RUG PULL DETECTED: Trust Score Reset to 0"
      >
        <Skull className="h-3 w-3" />
        EXILED
      </span>
    );
  }

  // Tier bazlı renk ve ikon ayarlaması
  const configs = {
    Legendary: { color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30", icon: <ShieldCheck className="h-3 w-3" /> },
    Elite: { color: "bg-purple-500/10 text-purple-400 border-purple-500/30", icon: <ShieldCheck className="h-3 w-3" /> },
    Proven: { color: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: <Shield className="h-3 w-3" /> },
    Contributor: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: <Shield className="h-3 w-3" /> },
    Newbie: { color: "bg-slate-500/10 text-slate-400 border-slate-500/30", icon: <ShieldAlert className="h-3 w-3" /> },
  };

  const config = configs[tier] || configs.Newbie;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium cursor-default select-none transition-colors ${config.color} ${className}`}
      title={`Trust Score: ${score}`}
    >
      {config.icon}
      {tier} {score > 0 && `(${score})`}
    </span>
  );
}