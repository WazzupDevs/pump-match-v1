"use client";

import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  TriangleAlert,
} from "lucide-react";

interface TrustBadgeProps {
  score?: number;
  tier?: "Newbie" | "Contributor" | "Proven" | "Elite" | "Legendary" | "EXILED";
  className?: string;
}

function labelForTier(
  tier: TrustBadgeProps["tier"]
): string {
  switch (tier) {
    case "Legendary":
      return "Legendary Signal";
    case "Elite":
      return "Elite Signal";
    case "Proven":
      return "Proven Signal";
    case "Contributor":
      return "Contributor Signal";
    case "EXILED":
      return "High Risk";
    case "Newbie":
    default:
      return "Early Signal";
  }
}

export function TrustBadge({
  score = 0,
  tier = "Newbie",
  className = "",
}: TrustBadgeProps) {
  if (tier === "EXILED") {
    return (
      <span
        className={`inline-flex cursor-help select-none items-center gap-1 rounded-full border border-rose-500/35 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-rose-300 ${className}`}
        title="Elevated risk surface detected"
      >
        <TriangleAlert className="h-3 w-3" />
        High Risk
      </span>
    );
  }

  const configs = {
    Legendary: {
      color: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
      icon: <ShieldCheck className="h-3 w-3" />,
    },
    Elite: {
      color: "border-violet-500/25 bg-violet-500/10 text-violet-300",
      icon: <ShieldCheck className="h-3 w-3" />,
    },
    Proven: {
      color: "border-blue-500/25 bg-blue-500/10 text-blue-300",
      icon: <Shield className="h-3 w-3" />,
    },
    Contributor: {
      color: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      icon: <Shield className="h-3 w-3" />,
    },
    Newbie: {
      color: "border-slate-500/25 bg-slate-500/10 text-slate-300",
      icon: <ShieldAlert className="h-3 w-3" />,
    },
  } as const;

  const config = configs[tier] ?? configs.Newbie;
  const label = labelForTier(tier);

  return (
    <span
      className={`inline-flex cursor-default select-none items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors ${config.color} ${className}`}
      title={`Public score surface: ${score}`}
    >
      {config.icon}
      {label}
      {score > 0 ? <span className="opacity-80">{score}</span> : null}
    </span>
  );
}