"use client";

import {
  UserPlus, Code, Palette, Megaphone, Waves, Users, Lock, BadgeCheck, ShieldCheck, Crown, Clock,
  DollarSign, Rocket, TrendingUp, Image, Tags, Target, Handshake, Gem, Scale,
  AlertTriangle, Shield, Heart, UserX, Link, ShieldOff, Info,
  type LucideIcon,
} from "lucide-react";
import type { IdentityState, MatchProfile, MatchReason, UserIntent } from "@/types";
import { getReasonConfig, sortMatchReasons, getMentorTip } from "@/lib/utils";

type MatchCardProps = {
  profile: MatchProfile;
  userIntent?: UserIntent | null;
  onConnect?: () => void;
};

function formatIntent(intent: UserIntent): string {
  return intent.replace(/_/g, " ");
}

function getRoleIcon(role: MatchProfile["role"]) {
  switch (role) {
    case "Dev":
      return <Code className="h-4 w-4" />;
    case "Artist":
      return <Palette className="h-4 w-4" />;
    case "Marketing":
      return <Megaphone className="h-4 w-4" />;
    case "Whale":
      return <Waves className="h-4 w-4" />;
    case "Community":
      return <Users className="h-4 w-4" />;
  }
}

function getRoleColor(role: MatchProfile["role"]) {
  switch (role) {
    case "Dev":
      return "from-blue-500/70 to-cyan-500/70 text-blue-200 border-blue-500/50 bg-blue-500/10";
    case "Artist":
      return "from-purple-500/70 to-pink-500/70 text-purple-200 border-purple-500/50 bg-purple-500/10";
    case "Marketing":
      return "from-orange-500/70 to-amber-500/70 text-orange-200 border-orange-500/50 bg-orange-500/10";
    case "Whale":
      return "from-indigo-500/70 to-violet-500/70 text-indigo-200 border-indigo-500/50 bg-indigo-500/10";
    case "Community":
      return "from-teal-500/70 to-emerald-500/70 text-teal-200 border-teal-500/50 bg-teal-500/10";
  }
}

function getTrustScoreColor(score: number) {
  if (score >= 80) {
    return "text-emerald-400";
  } else if (score >= 50) {
    return "text-amber-300";
  } else {
    return "text-rose-400";
  }
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 90) {
    return {
      text: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      label: "Perfect",
    };
  } else if (confidence >= 70) {
    return {
      text: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      label: "High",
    };
  } else {
    return {
      text: "text-slate-400",
      bg: "bg-gray-500/10",
      border: "border-gray-500/30",
      label: "Good",
    };
  }
}

function generateAvatarColor(username: string): string {
  // Generate color from username hash
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function getBadgeIcon(iconName: string) {
  switch (iconName) {
    case "BadgeCheck":
      return BadgeCheck;
    case "Waves":
      return Waves;
    case "ShieldCheck":
      return ShieldCheck;
    case "Crown":
      return Crown;
    case "Clock":
      return Clock;
    default:
      return BadgeCheck;
  }
}

function getBadgeColor(category: string) {
  switch (category) {
    case "SYSTEM":
      return "text-blue-500";
    case "SOCIAL":
      return "text-amber-500";
    default:
      return "text-slate-400";
  }
}

// Mentor Logic: Map icon name string to Lucide component
function getReasonIcon(iconName: string): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    DollarSign, Rocket, TrendingUp, Users, Palette, Image, Tags, Target,
    Handshake, Gem, Scale, AlertTriangle, Shield, Heart, Waves, Code,
    Crown, BadgeCheck, ShieldCheck, UserX, Link, Clock, ShieldOff, Info,
  };
  return iconMap[iconName] ?? Info;
}

// Identity Hierarchy & Sorting - CTO Tuning
function getIdentityBadge(identityState?: IdentityState): { icon: string; label: string; color: string } {
  switch (identityState) {
    case "VERIFIED":
      return { icon: "✅", label: "Verified", color: "text-amber-400" };
    case "REACHABLE":
      return { icon: "🐦", label: "Reachable", color: "text-sky-400" };
    case "GHOST":
    default:
      return { icon: "👻", label: "Ghost", color: "text-slate-500" };
  }
}

function getIdentityGlowClass(identityState?: IdentityState): string {
  switch (identityState) {
    case "VERIFIED":
      return "border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]";
    case "REACHABLE":
      return "border-sky-500/30 shadow-[0_0_10px_rgba(14,165,233,0.2)]";
    case "GHOST":
    default:
      return "border-slate-800";
  }
}

export function MatchCard({ profile, userIntent, onConnect }: MatchCardProps) {
  const avatarColor = generateAvatarColor(profile.username);
  const roleColorClass = getRoleColor(profile.role);
  const trustScoreColor = getTrustScoreColor(profile.trustScore);
  const confidenceColors = getConfidenceColor(profile.matchConfidence);
  
  // Identity Hierarchy & Sorting - CTO Tuning
  const identityBadge = getIdentityBadge(profile.identityState);
  const identityGlowClass = getIdentityGlowClass(profile.identityState);

  return (
    <div className={`rounded-xl border bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-950/90 p-5 shadow-lg transition-all duration-300 relative ${identityGlowClass}`}>
      {/* Header: Avatar + Username + Confidence Badge */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold text-lg shadow-lg flex-shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {profile.username.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-base font-semibold text-slate-100 truncate">{profile.username}</h3>
              {/* Identity Hierarchy Badge - CTO Tuning */}
              {profile.identityState && (
                <span
                  className={`text-xs font-medium ${identityBadge.color} flex items-center gap-1 flex-shrink-0`}
                  title={identityBadge.label}
                >
                  {identityBadge.icon}
                </span>
              )}
              {/* Social Proof Badges */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {profile.socialProof.verified && (
                  <div
                    className="flex items-center gap-0.5"
                    title="Algorithmic Verified"
                  >
                    <BadgeCheck className="h-4 w-4 text-blue-500" />
                  </div>
                )}
                {profile.socialProof.communityTrusted && (
                  <div
                    className="flex items-center gap-0.5"
                    title="Trusted by Community"
                  >
                    <ShieldCheck className="h-4 w-4 text-amber-500" />
                    {profile.socialProof.endorsements > 0 && (
                      <span className="text-[10px] text-amber-400 font-medium min-w-[24px] tabular-nums tracking-tight">
                        ({profile.socialProof.endorsements})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Confidence Badge - Transparent Tooltip */}
            <div
              className={`rounded-lg border ${confidenceColors.border} ${confidenceColors.bg} px-2 py-1 flex-shrink-0 cursor-help relative group`}
            >
              <span className={`text-xs font-bold min-w-[24px] tabular-nums tracking-tight ${confidenceColors.text}`}>
                {profile.matchConfidence}%
              </span>
              {/* Transparent Tooltip */}
              <div className="absolute right-0 top-full mt-2 w-72 p-3 rounded-lg border border-slate-700/80 bg-slate-900/95 backdrop-blur-sm shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 text-left">
                <p className="text-xs font-semibold text-slate-300 mb-2">Confidence Breakdown</p>
                <div className="space-y-1 text-[10px] text-slate-400">
                  <p>Base: <span className="text-slate-200">{profile.confidenceBreakdown.base}</span></p>
                  <p>Context: <span className="text-slate-200">+{profile.confidenceBreakdown.context}</span></p>
                  <p>
                    Badges: <span className="text-slate-200">+{profile.confidenceBreakdown.badgeCapped}</span>
                    {profile.confidenceBreakdown.badgeRaw > profile.confidenceBreakdown.badgeCapped && (
                      <span className="text-amber-400 ml-1">(Capped)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* v2: Intent Layer - Intent Mirroring */}
          {userIntent && profile.intent && (
            <div className="mt-2 px-2 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-xs">
              <div className="flex items-center justify-center gap-2 text-slate-300">
                <span className="font-medium">You: {formatIntent(userIntent)}</span>
                <span className="text-emerald-400">↔</span>
                <span className="font-medium">Them: {formatIntent(profile.intent)}</span>
              </div>
            </div>
          )}
          <div className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${roleColorClass}`}>
            {getRoleIcon(profile.role)}
            <span>{profile.role}</span>
          </div>
          {/* Active Badges - Visual Hierarchy: Social first (Gold), System second (Blue) */}
          {profile.activeBadges.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {/* Social Badges - Priority display (Gold) */}
              {profile.activeBadges
                .filter((badge) => badge.category === "SOCIAL")
                .map((badge) => {
                  const IconComponent = getBadgeIcon(badge.icon);
                  return (
                    <div
                      key={badge.id}
                      className={`inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 ${getBadgeColor(badge.category)}`}
                      title={`${badge.label} (+${badge.baseWeight})`}
                    >
                      <IconComponent className="h-3 w-3" />
                      <span className="text-[9px] font-medium">{badge.label}</span>
                    </div>
                  );
                })}
              {/* System Badges - Standard display (Blue) */}
              {profile.activeBadges
                .filter((badge) => badge.category === "SYSTEM")
                .map((badge) => {
                  const IconComponent = getBadgeIcon(badge.icon);
                  return (
                    <div
                      key={badge.id}
                      className={`inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 ${getBadgeColor(badge.category)}`}
                      title={`${badge.label} (+${badge.baseWeight})`}
                    >
                      <IconComponent className="h-3 w-3" />
                      <span className="text-[9px] font-medium">{badge.label}</span>
                    </div>
                  );
                })}
              {/* Contextual Badges - If present */}
              {profile.activeBadges
                .filter((badge) => badge.category === "CONTEXTUAL")
                .map((badge) => {
                  const IconComponent = getBadgeIcon(badge.icon);
                  return (
                    <div
                      key={badge.id}
                      className={`inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 ${getBadgeColor(badge.category)}`}
                      title={`${badge.label} (+${badge.baseWeight})`}
                    >
                      <IconComponent className="h-3 w-3" />
                      <span className="text-[9px] font-medium">{badge.label}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Trust Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-[0.15em] text-slate-500">Trust Score</span>
          <span className={`text-lg font-semibold min-w-[24px] tabular-nums tracking-tight ${trustScoreColor}`}>
            {profile.trustScore}
            <span className="text-xs text-slate-500 ml-1">/100</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              profile.trustScore >= 80
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                : profile.trustScore >= 50
                ? "bg-gradient-to-r from-amber-500 to-amber-400"
                : "bg-gradient-to-r from-rose-500 to-rose-400"
            }`}
            style={{ width: `${profile.trustScore}%` }}
          />
        </div>
      </div>

      {/* Tags */}
      {profile.tags.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1.5">
            {profile.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md border border-slate-700/50 bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mentor Logic: Top Drivers - Sorted by impact & status */}
      {profile.matchReasons && profile.matchReasons.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-2">Top Drivers</p>
          <div className="space-y-1.5">
            {sortMatchReasons(profile.matchReasons)
              .filter((r) => r.code !== "WEAK_LINK_APPLIED") // Internal, not user-facing
              .slice(0, 5) // Show top 5 reasons
              .map((reason, idx) => {
                const config = getReasonConfig(reason);
                const IconComponent = getReasonIcon(config.icon);
                const isPositive = reason.status === "POSITIVE";

                return (
                  <div
                    key={`${reason.code}-${idx}`}
                    className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors ${
                      isPositive
                        ? "bg-emerald-500/5 border border-emerald-500/10"
                        : "bg-slate-800/30 border border-dashed border-slate-700/40"
                    }`}
                  >
                    <IconComponent
                      className={`h-3.5 w-3.5 flex-shrink-0 ${
                        isPositive ? "text-emerald-400" : "text-slate-600"
                      }`}
                    />
                    <span
                      className={`flex-1 ${
                        isPositive
                          ? "text-emerald-400 font-medium"
                          : "text-slate-500 italic"
                      }`}
                    >
                      {config.label}
                    </span>
                    <span
                      className={`text-[9px] uppercase tracking-wider font-semibold ${
                        reason.impact === "HIGH"
                          ? isPositive ? "text-emerald-500/70" : "text-amber-500/50"
                          : "text-slate-600"
                      }`}
                    >
                      {reason.impact}
                    </span>
                  </div>
                );
              })}
          </div>
          {/* Mentor Tooltip: Improvement tip */}
          {(() => {
            const tip = getMentorTip(profile.matchReasons ?? []);
            if (!tip) return null;
            return (
              <div className="mt-2 flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-amber-500/5 border border-amber-500/10">
                <Info className="h-3 w-3 text-amber-400/60 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-400/70 leading-tight italic">
                  {tip}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Connect Button */}
      <button
        onClick={() => {
          if (onConnect) {
            onConnect();
          } else {
            alert("Invitation sent!");
          }
        }}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/70 transition-all duration-200 shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40"
      >
        <UserPlus className="h-4 w-4" />
        <span>Connect</span>
      </button>

      {/* Match Reason - legacy human-readable summary */}
      <p className="mt-3 text-xs text-slate-500 italic text-center">
        {profile.matchReason}
      </p>
    </div>
  );
}
