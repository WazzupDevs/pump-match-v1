"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import {
  BookOpen,
  Copy,
  Check,
  Twitter,
  Github,
  Rocket,
  Swords,
} from "lucide-react";

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function normalizeAddress(input: string): string {
  let normalized = input.trim();
  if (normalized.startsWith("web3:solana:")) {
    normalized = normalized.slice("web3:solana:".length);
  }
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
  const router = useRouter();
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

    if (!normalized) return;

    if (BASE58_REGEX.test(normalized)) {
      router.push(`/profile/${normalized}`);
      setQuery("");
      setIsInvalid(false);
    } else {
      setIsInvalid(true);
    }
  }

  return (
    <header className="fixed top-0 left-0 z-50 h-16 w-full border-b border-white/5 bg-slate-950/50 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Left: Logo + Brand */}
        <Link href="/" className="group flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="bg-linear-to-r from-emerald-400 to-purple-400 bg-clip-text text-base font-bold tracking-tight text-transparent">
            PumpMatch
          </span>
        </Link>

        {/* Right: Nav Links + Slot */}
        <div className="flex items-center gap-2">
          {/* CA Copy Badge */}
          <button
            onClick={handleCopy}
            aria-label={copied ? "Copied!" : "Copy contract address"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            <span className="hidden sm:inline">
              CA: {shortCA(CONTRACT_ADDRESS)}
            </span>
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
            aria-label="Follow PumpMatch on X"
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-emerald-400"
          >
            <Twitter className="h-4 w-4" aria-hidden="true" />
          </a>

          {/* GitHub Link */}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-emerald-400"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
          </a>

          {/* Docs Link */}
          <Link
            href="/docs"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname?.startsWith("/docs")
                ? "bg-emerald-500/5 text-emerald-400"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-emerald-400"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Docs
          </Link>

          {/* Command Center Link */}
          <Link
            href="/command-center"
            className={`hidden md:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname?.startsWith("/command-center")
                ? "bg-emerald-500/5 text-emerald-400"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-emerald-400"
            }`}
          >
            <Rocket className="h-3.5 w-3.5" />
            Command Center
          </Link>

          {/* Arena Link */}
          <Link
            href="/arena"
            className={`hidden md:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname?.startsWith("/arena")
                ? "bg-emerald-500/5 text-emerald-400"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-emerald-400"
            }`}
          >
            <Swords className="h-3.5 w-3.5" />
            Arena
          </Link>

          {/* Global wallet search */}
          <form onSubmit={handleSearchSubmit} className="hidden sm:block">
            <input
              type="text"
              name="wallet-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsInvalid(false);
              }}
              placeholder="Analyze wallet…"
              aria-label="Search wallet address"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={isInvalid}
              className={`w-36 rounded-lg border bg-slate-800/50 px-2.5 py-1.5 font-mono text-xs text-slate-200 placeholder:text-slate-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 ${
                isInvalid
                  ? "border-red-500/50 ring-1 ring-red-500/30"
                  : "border-slate-700/50"
              }`}
            />
          </form>

          {/* Wallet / Action Slot */}
          {children && <div className="ml-2">{children}</div>}
        </div>
      </div>
    </header>
  );
}