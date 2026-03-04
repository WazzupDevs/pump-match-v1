"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { BookOpen, Copy, Check, Twitter, Github } from "lucide-react";

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function normalizeAddress(input: string): string {
  let normalized = input.trim();
  if (normalized.startsWith("web3:solana:")) normalized = normalized.slice("web3:solana:".length);
  return normalized;
}

const CONTRACT_ADDRESS = "8UaLndGKh2jFCdsH9nK2krKMFtfDXNme6rQv8JRipump";
const TWITTER_URL = "https://x.com/PumpMatch";
const GITHUB_URL = "https://github.com/WazzupDevs/pump-match-v1";

function shortCA(ca: string) {
  if (ca.length <= 10) return ca;
  return `${ca.slice(0, 4)}...${ca.slice(-4)}`;
}

type NavbarProps = {
  children?: React.ReactNode;
};

export function Navbar({ children }: NavbarProps) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(CONTRACT_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeAddress(query);
    if (!normalized) return; // empty input: do nothing, don't mark invalid
    if (BASE58_REGEX.test(normalized)) {
      window.open(`/profile/${normalized}`, "_blank", "noopener,noreferrer");
      setQuery("");
      setIsInvalid(false);
    } else {
      setIsInvalid(true);
    }
  }

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
          {/* CA Copy Badge */}
          <button
            onClick={handleCopy}
            title={`Copy CA: ${CONTRACT_ADDRESS}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <span className="hidden sm:inline">CA: {shortCA(CONTRACT_ADDRESS)}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0" />
            )}
          </button>

          {/* X (Twitter) Link */}
          <a
            href={TWITTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Follow on X"
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50 transition-colors"
          >
            <Twitter className="h-4 w-4" />
          </a>

          {/* GitHub Link */}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50 transition-colors"
          >
            <Github className="h-4 w-4" />
          </a>

          {/* Docs Link */}
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

          {/* Global wallet search */}
          <form onSubmit={handleSearchSubmit} className="hidden sm:block">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsInvalid(false);
              }}
              placeholder="Wallet address…"
              className={`w-36 rounded-lg border bg-slate-800/50 px-2.5 py-1.5 text-xs font-mono text-slate-200 placeholder:text-slate-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 ${
                isInvalid ? "border-red-500/50 ring-1 ring-red-500/30" : "border-slate-700/50"
              }`}
              aria-invalid={isInvalid}
            />
          </form>

          {/* Wallet / Action Slot */}
          {children && (
            <div className="ml-2">{children}</div>
          )}
        </div>
      </div>
    </header>
  );
}
