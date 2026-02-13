"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import {
  BookOpen,
  ShieldCheck,
  Crosshair,
  Coins,
  ArrowLeft,
} from "lucide-react";

type NavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  group: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "intro",
    label: "Introduction",
    icon: <BookOpen className="h-4 w-4" />,
    group: "Getting Started",
  },
  {
    key: "trust",
    label: "Trust Score",
    icon: <ShieldCheck className="h-4 w-4" />,
    group: "Core Concepts",
  },
  {
    key: "god-mode",
    label: "God Mode",
    icon: <Crosshair className="h-4 w-4" />,
    group: "Core Concepts",
  },
  {
    key: "tokenomics",
    label: "$MATCH Utility",
    icon: <Coins className="h-4 w-4" />,
    group: "Economics",
  },
];

export function DocsSidebar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "intro";

  // Group items by section
  const groups = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  function navigate(key: string) {
    router.push(`/docs?tab=${key}`, { scroll: false });
  }

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-slate-800 bg-slate-950 px-4 py-6 overflow-y-auto">
      {/* Brand */}
      <button
        type="button"
        onClick={() => router.push("/")}
        className="flex items-center gap-2.5 mb-8 group"
      >
        <Logo className="h-7 w-7" />
        <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-purple-400 bg-clip-text text-transparent">
          PUMP MATCH
        </span>
      </button>

      {/* Back to App */}
      <button
        type="button"
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-emerald-400 transition-colors mb-6"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to App
      </button>

      {/* Nav Groups */}
      <nav className="flex-1 space-y-6">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600 font-semibold mb-2 px-3">
              {group}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const isActive = activeTab === item.key;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => navigate(item.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "text-emerald-400 bg-emerald-500/5 border-l-2 border-emerald-400 pl-4"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-l-2 border-transparent pl-4"
                      }`}
                    >
                      <span
                        className={
                          isActive ? "text-emerald-400" : "text-slate-600"
                        }
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-6 border-t border-slate-800/60">
        <p className="text-[10px] text-slate-600 leading-relaxed">
          Pump Match v1.0
          <br />
          Pump.fun Hackathon 2026
        </p>
      </div>
    </aside>
  );
}

/**
 * Mobile top-nav variant (visible on small screens).
 * Simple horizontal scroll of tab links.
 */
export function DocsMobileNav() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "intro";

  return (
    <div className="md:hidden sticky top-0 z-30 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-2"
        >
          <Logo className="h-6 w-6" />
          <span className="text-xs font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-purple-400 bg-clip-text text-transparent">
            PUMP MATCH
          </span>
        </button>
        <span className="text-slate-700">|</span>
        <span className="text-xs text-slate-500 font-medium">Docs</span>
      </div>
      <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                router.push(`/docs?tab=${item.key}`, { scroll: false })
              }
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
