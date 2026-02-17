"use client";

import { KeyRound } from "lucide-react";

interface FounderBadgeProps {
  className?: string;
}

/**
 * Premium pill-shaped Founder badge.
 * Displayed next to project names when claim_tier === 'founder'.
 * Includes a native title tooltip for accessibility.
 */
export function FounderBadge({ className = "" }: FounderBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 text-[10px] font-medium cursor-default select-none ${className}`}
      title="Verified On-Chain Update Authority"
    >
      <KeyRound className="h-3 w-3" />
      Founder
    </span>
  );
}
