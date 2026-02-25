"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket,
  RefreshCw,
  Loader2,
  Users,
  ShieldCheck,
} from "lucide-react";
import {
  getEliteAgents,
  getPowerSquads,
  triggerManualSync,
  type EliteAgent,
  type PowerSquadProject,
} from "@/app/actions/arena";
import { ClaimProjectModal } from "@/components/ClaimProjectModal";
import { SquadMemberModal } from "@/components/SquadMemberModal";
import { AgentCard } from "@/components/arena/agent-card";
import { ProjectCard } from "@/components/arena/project-card";

type ArenaTab = "agents" | "squads";

interface ArenaLeaderboardProps {
  walletAddress?: string;
  isOptedIn?: boolean;
}

// ──────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────

export function ArenaLeaderboard({
  walletAddress,
  isOptedIn,
}: ArenaLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<ArenaTab>("agents");
  const [agents, setAgents] = useState<EliteAgent[]>([]);
  const [projects, setProjects] = useState<PowerSquadProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const [squadModal, setSquadModal] = useState<{
    projectId: string;
    projectName: string;
    founderWallet: string;
  } | null>(null);
  const { signMessage } = useWallet();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [agentData, projectData] = await Promise.all([
        getEliteAgents(),
        getPowerSquads(),
      ]);
      setAgents(agentData);
      setProjects(projectData);
    } catch {
      // eslint-disable-next-line no-console
      console.error("[ArenaLeaderboard] Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleManualSync = useCallback(async () => {
    if (!walletAddress) return;

    // SECURITY (VULN-04): Prove admin wallet ownership before triggering sync.
    if (!signMessage) {
      setSyncResult("Wallet does not support message signing.");
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);
    try {
      const timestamp = Date.now();
      const messageText = `Admin: Sync Arena Data\nAddress: ${walletAddress}\nTimestamp: ${timestamp}`;
      const messageBytes = new TextEncoder().encode(messageText);
      const signatureBytes = await signMessage(messageBytes);
      const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));

      const result = await triggerManualSync(walletAddress, {
        message: messageText,
        signature: signatureBase64,
      });
      if (result.success) {
        setSyncResult(
          `Synced: ${result.updated} updated, ${result.ghosted} ghosted`,
        );
        await fetchData();
      } else {
        setSyncResult(result.error || "Sync failed");
      }
    } catch {
      setSyncResult("Sync failed unexpectedly");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncResult(null), 4000);
    }
  }, [fetchData, walletAddress, signMessage]);

  return (
    <section className="mt-14 md:mt-20">
      <div className="mx-auto max-w-4xl">
        {/* ── Section Header ── */}
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400/60 mb-3">
            The Arena
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-3">
            <span className="bg-gradient-to-r from-yellow-400 via-emerald-400 to-purple-400 bg-clip-text text-transparent">
              Leaderboard
            </span>
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Top network agents and squad projects ranked by trust score and
            market performance.
          </p>
        </div>

        {/* ── Tab Bar + Actions ── */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex rounded-xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-1">
            <button
              type="button"
              onClick={() => setActiveTab("agents")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === "agents"
                  ? "bg-emerald-500/15 text-emerald-400 shadow-inner shadow-emerald-500/5 border border-emerald-500/25"
                  : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Elite Agents
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("squads")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === "squads"
                  ? "bg-purple-500/15 text-purple-400 shadow-inner shadow-purple-500/5 border border-purple-500/25"
                  : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              <Rocket className="h-4 w-4" />
              Power Squads
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Claim Project CTA */}
            {activeTab === "squads" && walletAddress && isOptedIn && (
              <motion.button
                type="button"
                onClick={() => setIsClaimOpen(true)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:from-emerald-400 hover:to-emerald-300 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.03] active:scale-[0.97]"
              >
                <Rocket className="h-3.5 w-3.5" />
                Claim Project
              </motion.button>
            )}

            {/* Sync — any connected wallet can refresh market data */}
            {walletAddress && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="inline-flex items-center justify-center rounded-lg border border-slate-800/50 bg-slate-900/40 p-2.5 text-slate-700 hover:text-slate-400 hover:border-slate-600 transition-all disabled:opacity-50"
                title="Sync Arena Data"
              >
                {isSyncing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Sync Result Toast */}
        <AnimatePresence>
          {syncResult && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400"
            >
              <RefreshCw className="h-3 w-3" />
              {syncResult}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading State ── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
              <Loader2 className="relative h-7 w-7 text-emerald-400 animate-spin" />
            </div>
            <p className="text-sm text-slate-500">Loading leaderboard...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "agents" ? (
              /* ═══════════════════════════════════════════════
                 TAB 1: ELITE AGENTS
                 ═══════════════════════════════════════════════ */
              <motion.div
                key="agents-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {agents.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/40 bg-slate-900/50 p-12 text-center">
                    <Users className="h-9 w-9 text-slate-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">
                      No agents in the network yet.
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Be the first to join and claim the #1 spot.
                    </p>
                  </div>
                ) : (
                  agents.map((agent, i) => (
                    <AgentCard key={agent.id} agent={agent} index={i} />
                  ))
                )}
              </motion.div>
            ) : (
              /* ═══════════════════════════════════════════════
                 TAB 2: POWER SQUADS
                 ═══════════════════════════════════════════════ */
              <motion.div
                key="squads-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {projects.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/40 bg-slate-900/50 p-12 text-center">
                    <Rocket className="h-9 w-9 text-slate-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">
                      No projects in the Arena yet.
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Claim the first project and take the lead.
                    </p>
                  </div>
                ) : (
                  projects.map((project, i) => (
                    <div key={project.id} className="group relative">
                      <ProjectCard project={project} index={i} />
                      {/* Squad member count + action button */}
                      <div className="flex items-center justify-between mt-1.5 px-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                          <Users className="h-3 w-3" />
                          <span>
                            {project.memberCount > 0
                              ? `${project.memberCount} member${project.memberCount > 1 ? "s" : ""}`
                              : "No members yet"}
                          </span>
                        </div>
                        {walletAddress && isOptedIn && project.status !== "rugged" && (
                          <button
                            onClick={() =>
                              setSquadModal({
                                projectId: project.id,
                                projectName: project.name,
                                founderWallet: project.claimed_by_full ?? project.claimed_by,
                              })
                            }
                            className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-700/50 bg-slate-900/40 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all"
                          >
                            {project.claimed_by_full === walletAddress ? "Manage Squad" : "View Squad"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Claim Project Modal */}
      {walletAddress && (
        <ClaimProjectModal
          isOpen={isClaimOpen}
          onClose={() => setIsClaimOpen(false)}
          walletAddress={walletAddress}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}

      {/* Squad Member Modal */}
      {walletAddress && squadModal && (
        <SquadMemberModal
          projectId={squadModal.projectId}
          projectName={squadModal.projectName}
          isFounder={walletAddress.toLowerCase() === squadModal.founderWallet?.toLowerCase()}
          walletAddress={walletAddress}
          isOpen={!!squadModal}
          onClose={() => setSquadModal(null)}
          onSuccess={fetchData}
        />
      )}
    </section>
  );
}
