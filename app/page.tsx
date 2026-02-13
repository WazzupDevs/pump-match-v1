"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Fish, Dice5, Waves, Bot, History, Sparkles, Lock, X, Users, Wallet, Layers, Activity, AlertTriangle, Scan, Calendar, SlidersHorizontal, Code, Rocket, DollarSign, BadgeCheck, SearchX, ShieldCheck, Zap } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { analyzeWallet, getNetworkMatches, joinNetwork, searchNetworkAction } from "@/app/actions/analyzeWallet";
import type { MatchProfile, NetworkAgent, SearchFilters, UserIntent, WalletAnalysis } from "@/types";
import { MatchCard } from "@/components/match-card";
import { WalletButton } from "@/components/ui/wallet-button";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { Navbar } from "@/components/ui/navbar";

function formatAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatWalletAge(days: number | undefined): string {
  if (days == null) return "Unknown";
  if (days < 1) return "< 1 day";
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

export default function Home() {
  const { publicKey, connected } = useWallet();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string>(""); // Cool loading feedback
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<WalletAnalysis | null>(null);
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  // v2: Intent Layer - Onboarding Modal State
  const [showIntentModal, setShowIntentModal] = useState(false);
  const [userIntent, setUserIntent] = useState<UserIntent | null>(null);
  // Opt-In Network Architecture - Join Network State
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  // God Mode Discovery - Filter & Search
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<NetworkAgent[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const activityChartData = useMemo(() => {
    if (!analysis) return [];

    const points = [
      { label: "Score", score: analysis.score },
      { label: "Assets", score: Math.min(100, analysis.assetCount) },
      { label: "Tokens", score: Math.min(100, analysis.tokenCount * 2) },
    ];

    return points;
  }, [analysis]);

  const handleAnalyze = useCallback(async (addressOverride?: string) => {
    const address = (addressOverride ?? query).trim();
    if (!address) {
      setError("Please enter a wallet address.");
      return;
    }

    setError(null);
    setLoading(true);
    setLoadingPhase("Connecting to Solana...");

    try {
      // Loading phase feedback
      const phaseTimer = setTimeout(() => setLoadingPhase("Scanning On-Chain History..."), 1200);
      const phaseTimer2 = setTimeout(() => setLoadingPhase("Analyzing Asset Portfolio..."), 3000);
      const phaseTimer3 = setTimeout(() => setLoadingPhase("Detecting First Activity..."), 5000);
      const phaseTimer4 = setTimeout(() => setLoadingPhase("Calculating Trust Score..."), 7000);

      const response = await analyzeWallet(address, userIntent || undefined);

      // Clear phase timers
      clearTimeout(phaseTimer);
      clearTimeout(phaseTimer2);
      clearTimeout(phaseTimer3);
      clearTimeout(phaseTimer4);

      const walletAnalysis = response.walletAnalysis;
      
      // v2: Intent Layer - Show modal if intent not selected after analysis
      if (!userIntent) {
        setShowIntentModal(true);
      }
      
      setAnalysis(walletAnalysis);
      
      // Opt-In Network Architecture - If registered, fetch network matches
      if (walletAnalysis.isRegistered) {
        setLoadingPhase("Fetching Network Matches...");
        try {
          const networkMatches = await getNetworkMatches(walletAnalysis.address, walletAnalysis);
          setMatches(networkMatches);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("Failed to fetch network matches:", err);
          setMatches(response.matches); // Fallback to mock matches
        }
      } else {
        setMatches(response.matches);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : "An error occurred during analysis.";
      setError(errorMsg);
      setAnalysis(null);
      setMatches([]);
    } finally {
      setLoading(false);
      setLoadingPhase("");
    }
  }, [query, userIntent]);

  // Handle "Analyze My Wallet" when wallet is connected
  const handleAnalyzeMyWallet = useCallback(() => {
    if (publicKey) {
      const walletAddress = publicKey.toBase58();
      setQuery(walletAddress);
      handleAnalyze(walletAddress);
    }
  }, [publicKey, handleAnalyze]);

  // God Mode Discovery: Search Network with filters
  const handleSearchNetwork = useCallback(async (filters: SearchFilters) => {
    setIsSearching(true);
    try {
      const results = await searchNetworkAction(filters);
      setSearchResults(results);
      setFilterOpen(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Search failed:", err);
      setSearchResults([]);
      setFilterOpen(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // God Mode Discovery: Click on agent card -> analyze their wallet
  const handleAgentClick = useCallback((agent: NetworkAgent) => {
    setSearchResults(null); // Clear search results
    setQuery(agent.address);
    handleAnalyze(agent.address);
  }, [handleAnalyze]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      {/* TOP NAVIGATION BAR */}
      <Navbar>
        <WalletButton />
      </Navbar>

      <main className="w-full max-w-5xl mx-auto px-4 pt-24 pb-16 md:pt-28 md:pb-24">
        {/* HERO SECTION */}
        <div className="flex flex-col items-center text-center gap-6">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400/70">
            The on-chain matchmaking engine for the Pump.fun ecosystem.
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight">
            <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(16,185,129,0.55)]">
              Find Your Perfect Squad
            </span>
            <br />
            <span className="text-slate-200/90">on Solana</span>
          </h1>
          <p className="max-w-xl text-sm md:text-base text-slate-400">
            Match with verified devs, whales, and early adopters. Score
            trustworthiness and build your dream squad on-chain.
          </p>

          {/* CONNECTED WALLET: "Analyze My Wallet" CTA */}
          {connected && publicKey && !analysis && (
            <button
              type="button"
              onClick={handleAnalyzeMyWallet}
              disabled={loading}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-500/30"
            >
              <Scan className="h-5 w-5" />
              {loading ? "Scanning..." : "Analyze My Wallet"}
            </button>
          )}

          {/* SEARCH INPUT */}
          <div className="mt-4 w-full max-w-2xl">
            <div className="relative group">
              <div className="absolute -inset-px rounded-full bg-gradient-to-r from-emerald-500/70 via-emerald-400/70 to-purple-500/70 opacity-70 blur-xl group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center gap-3 rounded-full border border-emerald-500/60 bg-slate-900/80 px-6 py-4 shadow-[0_0_40px_rgba(34,197,94,0.35)] backdrop-blur">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/60 bg-slate-900/80 text-emerald-300 text-sm">
                  🔍
                </span>
                <input
                  type="search"
                  placeholder={connected ? "Or search any wallet address..." : "Search by Wallet Address..."}
                  className="w-full bg-transparent text-base md:text-lg placeholder:text-slate-500 focus:outline-none"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleAnalyze();
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAnalyze()}
                  disabled={loading}
                  className="hidden md:inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Analyzing..." : "Analyze"}
                </button>
                {/* God Mode Discovery: Filter Button */}
                <button
                  type="button"
                  onClick={() => setFilterOpen(true)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 p-2.5 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
                  title="Discovery Filters"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11px] md:text-xs text-slate-500 text-left">
              {connected
                ? "Connected. Use the button above or search any address."
                : "Connect your wallet or paste any Solana address."}
            </p>

            {/* Loading Phase Indicator */}
            {loading && loadingPhase && (
              <div className="mt-4 flex items-center gap-3 justify-center">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-sm text-emerald-400/80 font-medium animate-pulse">
                  {loadingPhase}
                </p>
              </div>
            )}

            {/* Error Card (graceful, not just text) */}
            {error && !loading && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-rose-300">Analysis Failed</p>
                  <p className="text-xs text-rose-400/70 mt-1">{error}</p>
                  <button
                    onClick={() => { setError(null); handleAnalyze(); }}
                    className="mt-2 text-xs text-rose-300 underline underline-offset-2 hover:text-rose-200 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GOD MODE DISCOVERY: Search Results Grid */}
        {searchResults !== null && (
          <section className="mt-12 md:mt-16">
            <div className="mx-auto max-w-5xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-400/70 mb-1">
                    Discovery
                  </p>
                  <h2 className="text-xl md:text-2xl font-semibold text-slate-100">
                    <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">
                      Network Agents
                    </span>
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({searchResults.length})
                    </span>
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchResults(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              </div>

              {searchResults.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {searchResults.map((agent) => (
                    <AgentMicroCard
                      key={agent.id}
                      agent={agent}
                      onClick={() => handleAgentClick(agent)}
                    />
                  ))}
                </div>
              ) : (
                /* Empty State */
                <div className="mx-auto max-w-md rounded-2xl border border-slate-700/40 bg-slate-900/50 p-10 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-slate-700/50 bg-slate-800/30 mb-4">
                    <SearchX className="h-6 w-6 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">
                    No degens found matching this criteria.
                  </p>
                  <p className="text-xs text-slate-600 mt-2">
                    Try lowering the trust score or removing some filters.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFilterOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Adjust Filters
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ANALYSIS */}
        {analysis && !searchResults && (
          <section className="mt-12 md:mt-16">
            <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-slate-950 via-slate-950/95 to-slate-900/90 p-6 md:p-8 shadow-[0_0_60px_rgba(34,197,94,0.45)] shadow-emerald-500/30">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-400/70 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      TRUST ANALYSIS
                    </p>
                    <p className="text-sm text-slate-300">
                      {formatAddress(analysis.address)}
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-[10px] font-semibold tracking-wide text-green-400">
                  LIVE DATA
                </span>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)] items-start">
                {/* TRUST SCORE HERO CARD */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 md:p-6 shadow-lg shadow-emerald-500/20">
                  <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
                    <div className="flex flex-col items-center">
                      <div className="relative w-32 h-32 md:w-40 md:h-40 flex items-center justify-center">
                        <svg
                          viewBox="0 0 120 120"
                          className="w-full h-full -rotate-90"
                        >
                          <circle
                            cx="60"
                            cy="60"
                            r="50"
                            className="text-slate-800"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                          />
                          <circle
                            cx="60"
                            cy="60"
                            r="50"
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray="314"
                            strokeDashoffset={
                              314 - (314 * analysis.trustScore) / 100
                            }
                            className="transition-all duration-500 ease-out"
                            stroke={
                              analysis.trustScore >= 80
                                ? "#22c55e"
                                : analysis.trustScore >= 50
                                ? "#facc15"
                                : "#ef4444"
                            }
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span
                            className={`text-4xl font-bold tracking-tighter drop-shadow-[0_0_40px_rgba(16,185,129,0.8)] ${
                              analysis.trustScore >= 80
                                ? "text-emerald-400"
                                : analysis.trustScore >= 50
                                ? "text-amber-300"
                                : "text-rose-400"
                            }`}
                          >
                            {analysis.trustScore}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2 text-center">
                        TRUST SCORE
                      </p>
                    </div>
                    <div className="flex-1 w-full">
                      <p className="text-[10px] text-slate-500/60 leading-tight mb-4">
                        High value wallet with significant on-chain history and diverse asset portfolio.
                      </p>
                      {/* Stats Grid - Financial Dashboard Style */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-4 w-full">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-0.5">
                            SOL Balance
                          </span>
                          <span className="text-sm text-white font-mono font-bold tracking-tight tabular-nums leading-none">
                            {analysis.solBalance.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-0.5">
                            Tx Count
                          </span>
                          <span className="text-sm text-white font-mono font-bold tracking-tight tabular-nums leading-none">
                            {analysis.transactionCount === -1
                              ? "Unknown"
                              : analysis.transactionCount >= 1000
                              ? `${Math.floor(analysis.transactionCount / 1000).toLocaleString()},${String(analysis.transactionCount % 1000).padStart(3, "0")}+`
                              : analysis.transactionCount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-0.5">
                            Tokens
                          </span>
                          <span className="text-sm text-white font-mono font-bold tracking-tight tabular-nums leading-none">
                            {analysis.tokenCount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-0.5">
                            Assets
                          </span>
                          <span className="text-sm text-white font-mono font-bold tracking-tight tabular-nums leading-none">
                            {analysis.nftCount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {/* Production Grade: First Activity Detected */}
                      {analysis.approxWalletAge != null && (
                        <div className="flex items-center gap-2 mt-3 px-2 py-1.5 rounded-md bg-slate-800/40 border border-slate-700/30">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-[10px] uppercase text-slate-500 tracking-wider">
                            First Activity Detected
                          </span>
                          <span className="text-[10px] text-slate-300 font-mono font-semibold ml-auto">
                            {formatWalletAge(analysis.approxWalletAge)} ago
                          </span>
                        </div>
                      )}
                      {/* Pump Match - Badge Scores (Transparency) */}
                      <div className="pt-3 border-t border-slate-800 mt-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">
                          Badge Scores
                        </p>
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          <span className="text-blue-400">
                            System: {analysis.systemScore}
                          </span>
                          <span className="text-amber-400">
                            Social: {analysis.socialScore.toFixed(1)} {analysis.socialScore !== analysis.systemScore + analysis.socialScore && "(Decayed)"}
                          </span>
                        </div>
                      </div>
                      {analysis.badges.length > 0 && (
                        <div className="pt-2 border-t border-slate-800 mt-2">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">
                            Active Badges
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {analysis.badges.includes("whale") && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500/70 via-sky-500/70 to-violet-500/70 px-3 py-1 text-[11px] text-slate-50 shadow-md shadow-sky-500/30">
                                <Waves className="h-3.5 w-3.5" />
                                <span className="font-semibold">Whale</span>
                              </div>
                            )}
                            {analysis.badges.includes("dev") && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500/70 to-cyan-500/70 px-3 py-1 text-[11px] text-slate-50 shadow-md shadow-blue-500/30">
                                <Sparkles className="h-3.5 w-3.5" />
                                <span className="font-semibold">Dev</span>
                              </div>
                            )}
                            {analysis.badges.includes("og_wallet") && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/70 to-yellow-500/80 px-3 py-1 text-[11px] text-slate-950 shadow-md shadow-amber-500/40">
                                <History className="h-3.5 w-3.5" />
                                <span className="font-semibold">OG Wallet</span>
                              </div>
                            )}
                            {analysis.badges.includes("community_trusted") && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/70 to-yellow-500/80 px-3 py-1 text-[11px] text-slate-950 shadow-md shadow-amber-500/40">
                                <Sparkles className="h-3.5 w-3.5" />
                                <span className="font-semibold">Community Trusted</span>
                              </div>
                            )}
                            {analysis.badges.includes("governor") && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/70 to-yellow-500/80 px-3 py-1 text-[11px] text-slate-950 shadow-md shadow-amber-500/40">
                                <Sparkles className="h-3.5 w-3.5" />
                                <span className="font-semibold">Governor</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* STATS + CHART */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 md:p-5 shadow-lg shadow-emerald-500/15">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-3">
                      Wallet Stats
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs md:text-sm">
                      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          SOL Balance
                        </p>
                        <p className="mt-1 text-emerald-300 font-semibold">
                          {analysis.solBalance.toFixed(4)} SOL
                        </p>
                      </div>
                      <div className="rounded-xl border border-sky-500/40 bg-sky-500/5 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Tokens
                        </p>
                        <p className="mt-1 text-sky-200 font-semibold">
                          {analysis.tokenCount}
                        </p>
                      </div>
                      <div className="rounded-xl border border-purple-500/40 bg-purple-500/5 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Transactions
                        </p>
                        <p className="mt-1 text-purple-200 font-semibold">
                          {analysis.transactionCount === -1
                            ? "N/A"
                            : analysis.transactionCount === 1000
                            ? "1000+"
                            : analysis.transactionCount.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          NFTs / Assets
                        </p>
                        <p className="mt-1 text-amber-200 font-semibold">
                          {analysis.nftCount}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 md:p-5 shadow-lg shadow-emerald-500/15">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Activity Snapshot
                      </p>
                      <span className="text-[11px] text-emerald-300">
                        Heuristic score
                      </span>
                    </div>
                    <div className="h-40 md:h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={activityChartData}
                          margin={{ left: -20, right: 0, top: 5, bottom: 0 }}
                        >
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#6b7280", fontSize: 11 }}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#6b7280", fontSize: 11 }}
                            tickCount={5}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#020617",
                              border: "1px solid rgba(52,211,153,0.5)",
                              borderRadius: "0.75rem",
                              padding: "8px 10px",
                              fontSize: 11,
                            }}
                            labelStyle={{ color: "#e5e7eb", marginBottom: 4 }}
                            cursor={{
                              stroke: "rgba(148,163,184,0.4)",
                              strokeWidth: 1,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#22c55e"
                            strokeWidth={2.4}
                            dot={false}
                            activeDot={{
                              r: 5,
                              stroke: "#22c55e",
                              strokeWidth: 2,
                              fill: "#0f172a",
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Score calculated based on balance, token diversity, and asset count.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* MATCH LAYER - Recommended Squad Matches or Locked State */}
        {analysis && !searchResults && (
          <section className="mt-12 md:mt-16">
            <div className="mx-auto max-w-6xl">
              <div className="text-center mb-8">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-400/70 mb-2">
                  Match Layer
                </p>
                <h2 className="text-2xl md:text-3xl font-semibold text-slate-100 mb-2">
                  <span className="bg-gradient-to-r from-emerald-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
                    🤝 Recommended Squad Matches
                  </span>
                </h2>
              </div>

              {/* Opt-In Network Architecture - State 1 (Guest) vs State 2 (Member) */}
              {analysis.trustScore < 50 ? (
                /* Locked State - Trust Score too low */
                <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/20 bg-gradient-to-br from-slate-950 via-red-950/10 to-slate-900/90 p-8 md:p-12 text-center shadow-lg shadow-red-500/10">
                  <div className="mb-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-red-500/50 bg-red-500/10 mb-4">
                      <Lock className="h-10 w-10 text-red-400" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-semibold text-slate-100 mb-2">
                      Matchmaking Locked
                    </h3>
                  </div>
                  <p className="text-sm md:text-base text-slate-300 mb-4 leading-relaxed">
                    Trust Score too low (&lt;50). Your current score is{" "}
                    <span className="text-red-400 font-semibold">{analysis.trustScore}/100</span>.
                    Increase system activity or earn community trust.
                  </p>
                  <div className="mt-6 p-4 rounded-lg border border-slate-700/50 bg-slate-800/30">
                    <p className="text-xs text-slate-400 mb-2">💡 Tips to improve your score:</p>
                    <ul className="text-xs text-slate-500 space-y-1 text-left max-w-md mx-auto">
                      <li>• Increase your SOL balance (System Score: {analysis.systemScore})</li>
                      <li>• Make more transactions</li>
                      <li>• Earn community trust (Social Score: {analysis.socialScore.toFixed(1)})</li>
                      <li>• Build a consistent on-chain history</li>
                    </ul>
                  </div>
                </div>
              ) : !analysis.isRegistered ? (
                /* STATE 1: Guest - Lock matches, show "Join Network" CTA */
                <div className="mx-auto max-w-2xl rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-950 via-amber-950/10 to-slate-900/90 p-8 md:p-12 text-center shadow-lg shadow-amber-500/10">
                  <div className="mb-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-amber-500/50 bg-amber-500/10 mb-4">
                      <Users className="h-10 w-10 text-amber-400" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-semibold text-slate-100 mb-2">
                      Join Pump Match Network
                    </h3>
                  </div>
                  <p className="text-sm md:text-base text-slate-300 mb-6 leading-relaxed">
                    You&apos;re viewing preview matches. Join the Pump Match Network to unlock real connections and find your perfect squad.
                  </p>
                  
                  {/* Username Input */}
                  <div className="mb-6">
                    <input
                      type="text"
                      placeholder="Choose a username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full max-w-xs mx-auto px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  
                  {/* Join Network Button */}
                  <button
                    onClick={async () => {
                      if (!analysis || !userIntent) {
                        setJoinError("Please select an intent first");
                        return;
                      }
                      if (!username.trim()) {
                        setJoinError("Please enter a username");
                        return;
                      }
                      
                      setIsJoining(true);
                      setJoinError(null);
                      
                      try {
                        const result = await joinNetwork(analysis.address, username.trim(), analysis);
                        if (result.success) {
                          // Refresh analysis to get isRegistered = true
                          await handleAnalyze();
                        } else {
                          setJoinError(result.message);
                        }
                      } catch (err) {
                        setJoinError("Failed to join network. Please try again.");
                      } finally {
                        setIsJoining(false);
                      }
                    }}
                    disabled={isJoining || !userIntent || !username.trim()}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <Users className="h-4 w-4" />
                    {isJoining ? "Joining..." : "Join Pump Match Network"}
                  </button>
                  
                  {joinError && (
                    <p className="mt-4 text-sm text-red-400">{joinError}</p>
                  )}
                  
                  <p className="mt-6 text-xs text-slate-500">
                    By joining, you agree to be discoverable by other network members.
                  </p>
                </div>
              ) : matches.length > 0 ? (
                /* STATE 2: Member - Show network matches */
                <>
                  <p className="text-sm text-slate-400 max-w-2xl mx-auto text-center mb-8">
                    Active network members matching your profile. These are real users who have opted into the network.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matches.map((profile) => (
                      <MatchCard
                        key={profile.id}
                        profile={profile}
                        userIntent={userIntent}
                        onConnect={() => {
                          alert("Invitation sent!");
                        }}
                      />
                    ))}
                  </div>
                </>
              ) : (
                /* STATE 2: Member but no matches found */
                <div className="mx-auto max-w-2xl rounded-2xl border border-slate-700/50 bg-slate-900/50 p-8 md:p-12 text-center">
                  <p className="text-slate-400">
                    No network members found yet. Be the first to join!
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* v2: Intent Layer - Onboarding Modal */}
        {showIntentModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 md:p-8 max-w-md w-full shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-100">What are you looking for?</h2>
                <button
                  onClick={() => setShowIntentModal(false)}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-6">
                Help us find better matches by selecting your intent:
              </p>
              <div className="space-y-2">
                {(["BUILD_SQUAD", "FIND_FUNDING", "HIRE_TALENT", "JOIN_PROJECT", "NETWORK"] as UserIntent[]).map((intent) => (
                  <button
                    key={intent}
                    onClick={async () => {
                      setUserIntent(intent);
                      setShowIntentModal(false);
                      // Re-run analysis after intent selection
                      if (query.trim()) {
                        setLoading(true);
                        try {
                          const response = await analyzeWallet(query.trim(), intent);
                          setAnalysis(response.walletAnalysis);
                          setMatches(response.matches);
                        } catch (err) {
                          // eslint-disable-next-line no-console
                          console.error(err);
                          setError("An error occurred during analysis.");
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                      userIntent === intent
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                        : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <div className="font-medium">{intent.replace(/_/g, " ")}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowIntentModal(false);
                  // Run analysis on skip (without intent)
                  if (query.trim() && !userIntent) {
                    handleAnalyze();
                  }
                }}
                className="mt-4 w-full px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
        {/* God Mode Discovery: Filter Sheet */}
        <FilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          onSearch={handleSearchNetwork}
          isSearching={isSearching}
        />
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// God Mode Discovery: Agent Micro Card (Minimal, Click-to-Expand)
// ──────────────────────────────────────────────────────────────

function getAgentTrustColor(score: number) {
  if (score >= 90) return "text-emerald-400";
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-amber-300";
  return "text-rose-400";
}

function getAgentIdentityIcon(state?: string) {
  switch (state) {
    case "VERIFIED": return "✅";
    case "REACHABLE": return "🐦";
    default: return "👻";
  }
}

function generateAgentColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

function AgentMicroCard({ agent, onClick }: { agent: NetworkAgent; onClick: () => void }) {
  const avatarColor = generateAgentColor(agent.username);
  const trustColor = getAgentTrustColor(agent.trustScore);
  const identityIcon = getAgentIdentityIcon(agent.identityState);

  // Badge icon mapping (icons only, no labels)
  const badgeIcons = agent.activeBadges.slice(0, 3).map((badge) => {
    switch (badge.icon) {
      case "Waves": return <Waves key={badge.id} className="h-3 w-3 text-indigo-400" />;
      case "Code": return <Code key={badge.id} className="h-3 w-3 text-blue-400" />;
      case "ShieldCheck": return <ShieldCheck key={badge.id} className="h-3 w-3 text-amber-400" />;
      case "Crown": return <BadgeCheck key={badge.id} className="h-3 w-3 text-amber-400" />;
      case "Clock": return <History key={badge.id} className="h-3 w-3 text-slate-400" />;
      default: return <BadgeCheck key={badge.id} className="h-3 w-3 text-slate-400" />;
    }
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-200 hover:scale-[1.02] cursor-pointer ${
        agent.identityState === "VERIFIED"
          ? "border-amber-500/30 bg-gradient-to-b from-amber-950/20 via-slate-950/90 to-slate-950/90 hover:border-amber-500/50 shadow-sm shadow-amber-500/10"
          : "border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-900/80"
      }`}
    >
      {/* Avatar */}
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md flex-shrink-0"
        style={{ backgroundColor: avatarColor }}
      >
        {agent.username.charAt(0).toUpperCase()}
      </div>

      {/* Username + Identity */}
      <div className="flex items-center gap-1 min-w-0 w-full justify-center">
        <span className="text-xs font-medium text-slate-200 truncate max-w-[100px]">
          {agent.username}
        </span>
        <span className="text-[10px] flex-shrink-0" title={agent.identityState ?? "Ghost"}>
          {identityIcon}
        </span>
      </div>

      {/* Trust Score - BIG & COLORED */}
      <div className="flex flex-col items-center">
        <span className={`text-2xl font-bold tabular-nums tracking-tighter leading-none ${trustColor}`}>
          {agent.trustScore}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-slate-600 mt-0.5">
          Trust
        </span>
      </div>

      {/* Badge Icons Row */}
      {badgeIcons.length > 0 && (
        <div className="flex items-center gap-1.5">
          {badgeIcons}
        </div>
      )}

      {/* Hover hint */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-xl bg-emerald-500/0 group-hover:bg-emerald-500/40 transition-colors" />
    </button>
  );
}
