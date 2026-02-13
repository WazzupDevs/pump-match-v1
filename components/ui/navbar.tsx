"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { BookOpen } from "lucide-react";

type NavbarProps = {
  children?: React.ReactNode; // Right-side slot (e.g. Wallet Button)
};

export function Navbar({ children }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 w-full z-50 h-16 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Left: Logo + Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <Logo className="h-7 w-7" />
          <span className="text-base font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-purple-400 bg-clip-text text-transparent">
            Pump Match
          </span>
        </Link>

        {/* Right: Nav Links + Slot */}
        <div className="flex items-center gap-2">
          <Link
            href="/docs"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname?.startsWith("/docs")
                ? "text-emerald-400 bg-emerald-500/5"
                : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Docs
          </Link>

          {/* Wallet / Action Slot */}
          {children && (
            <div className="ml-2">{children}</div>
          )}
        </div>
      </div>
    </header>
  );
}
