"use client";

import { useState } from "react";
import {
  X,
  Waves,
  Code,
  Rocket,
  DollarSign,
  ShieldCheck,
  SlidersHorizontal,
  Search,
} from "lucide-react";
import type { SearchFilters } from "@/types";

type FilterSheetProps = {
  open: boolean;
  onClose: () => void;
  onSearch: (filters: SearchFilters) => void;
  isSearching?: boolean;
};

// Available badge filters for discovery
const ROLE_FILTERS = [
  { id: "whale", label: "Whale", icon: Waves, color: "border-indigo-500/50 bg-indigo-500/10 text-indigo-300" },
  { id: "dev", label: "Dev", icon: Code, color: "border-blue-500/50 bg-blue-500/10 text-blue-300" },
  { id: "early_adopter", label: "Early Adopter", icon: Rocket, color: "border-amber-500/50 bg-amber-500/10 text-amber-300" },
  { id: "high_roller", label: "High Roller", icon: DollarSign, color: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" },
] as const;

export function FilterSheet({ open, onClose, onSearch, isSearching }: FilterSheetProps) {
  const [minTrustScore, setMinTrustScore] = useState(70);
  const [selectedBadges, setSelectedBadges] = useState<Set<string>>(new Set());
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  function toggleBadge(badgeId: string) {
    setSelectedBadges((prev) => {
      const next = new Set(prev);
      if (next.has(badgeId)) {
        next.delete(badgeId);
      } else {
        next.add(badgeId);
      }
      return next;
    });
  }

  function handleSearch() {
    const filters: SearchFilters = {
      badgeFilters: Array.from(selectedBadges),
      minTrustScore,
      verifiedOnly,
    };
    onSearch(filters);
  }

  function handleReset() {
    setMinTrustScore(70);
    setSelectedBadges(new Set());
    setVerifiedOnly(false);
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet (slides from right) */}
      <div className="fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col bg-slate-950 border-l border-slate-800 shadow-2xl shadow-black/50 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
              Discovery Filters
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
          {/* Min Trust Score Slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Min Trust Score
              </label>
              <span className="text-sm font-mono font-bold text-emerald-400 tabular-nums min-w-[32px] text-right">
                {minTrustScore}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minTrustScore}
              onChange={(e) => setMinTrustScore(Number(e.target.value))}
              className="w-full h-1.5 rounded-full bg-slate-800 appearance-none cursor-pointer accent-emerald-500
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-emerald-500/40 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-300
                [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-400 [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-emerald-300"
            />
            <div className="flex justify-between mt-1.5 text-[10px] text-slate-600">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          {/* Role / Badge Toggles */}
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-3">
              Roles
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_FILTERS.map((role) => {
                const isActive = selectedBadges.has(role.id);
                const IconComponent = role.icon;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleBadge(role.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                      isActive
                        ? `${role.color} border-opacity-100 shadow-md`
                        : "border-slate-700/50 bg-slate-800/30 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                    }`}
                  >
                    <IconComponent className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{role.label}</span>
                  </button>
                );
              })}
            </div>
            {selectedBadges.size > 1 && (
              <p className="mt-2 text-[10px] text-amber-400/70 italic">
                AND mode: agent must match all selected roles
              </p>
            )}
          </div>

          {/* Verified Only Switch */}
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-3">
              Safety
            </label>
            <button
              type="button"
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg border transition-all ${
                verifiedOnly
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-slate-700/50 bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-4 w-4 ${verifiedOnly ? "text-amber-400" : "text-slate-500"}`} />
                <span className={`text-xs font-medium ${verifiedOnly ? "text-amber-300" : "text-slate-400"}`}>
                  Verified Only
                </span>
              </div>
              {/* Toggle visual */}
              <div
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  verifiedOnly ? "bg-amber-500" : "bg-slate-700"
                }`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    verifiedOnly ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Search className="h-4 w-4" />
            {isSearching ? "Searching..." : "Find Agents"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full px-4 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </>
  );
}
