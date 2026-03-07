"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Trophy,
  Medal,
  ShieldCheck,
  Loader2,
  Check,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import type { EliteAgent } from "@/app/actions/arena";
import { addSquadMemberAction } from "@/app/actions/arena";
import {
  generateCanonicalMessageV1,
  type PumpMatchPayload,
} from "@/lib/signature-shared";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function formatAddress(address: string) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function generateAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

function createNonceBase58(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bs58.encode(bytes);
}

// ──────────────────────────────────────────────────────────────
// Rank Icon
// ──────────────────────────────────────────────────────────────

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 shadow-lg shadow-yellow-500/50 ring-2 ring-yellow-400/40">
        <Crown className="h-5 w-5 text-yellow-950" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 shadow-lg shadow-slate-400/40 ring-2 ring-slate-300/30">
        <Trophy className="h-4 w-4 text-slate-700" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600 shadow-lg shadow-orange-500/40 ring-2 ring-orange-400/30">
        <Medal className="h-4 w-4 text-orange-100" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-700/60 bg-slate-800/70">
      <span className="text-sm font-bold text-slate-400 tabular-nums">
        {rank}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Card Style
// ──────────────────────────────────────────────────────────────

function getCardStyle(rank: number): string {
  // pm-card provides base glass + transition; pm-glow-purple provides default hover.
  // Only return rank-specific overrides here.
  if (rank === 1)
    return "scale-[1.02] border-yellow-400/50 bg-gradient-to-br from-yellow-500/10 to-transparent shadow-[0_0_30px_-5px_rgba(250,204,21,0.2)] hover:shadow-[0_0_36px_-5px_rgba(250,204,21,0.28)]";
  if (rank === 2)
    return "border-slate-300/40 bg-gradient-to-br from-slate-400/5 to-transparent shadow-[0_0_20px_-5px_rgba(148,163,184,0.15)]";
  if (rank === 3)
    return "border-orange-400/40 bg-gradient-to-br from-orange-500/5 to-transparent shadow-[0_0_20px_-5px_rgba(251,146,60,0.15)]";
  return ""; // pm-card + pm-glow-purple handle the default case
}

// ──────────────────────────────────────────────────────────────
// Invite state machine
// ──────────────────────────────────────────────────────────────

type InviteState = "idle" | "signing" | "sending" | "success" | "error";

// ──────────────────────────────────────────────────────────────
// Portal Dropdown
// ──────────────────────────────────────────────────────────────

interface PortalDropdownProps {
  anchorRect: DOMRect;
  items: { id: string; name: string }[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

function PortalDropdown({ anchorRect, items, onSelect, onClose }: PortalDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click and Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Position above the anchor button
  const style: React.CSSProperties = {
    position: "fixed",
    right: window.innerWidth - anchorRect.right,
    bottom: window.innerHeight - anchorRect.top + 8,
    zIndex: 9999,
    minWidth: Math.max(anchorRect.width, 180),
    maxWidth: 280,
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        style={style}
        className="rounded-2xl border border-purple-500/25 bg-slate-900/95 backdrop-blur-xl p-2 shadow-2xl z-50"
      >
        <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">
          Select Project
        </p>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onClose();
              onSelect(item.id);
            }}
            className="w-full truncate rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-300 transition-[background-color] duration-150 hover:bg-purple-500/15 hover:text-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-inset"
          >
            {item.name}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

// ──────────────────────────────────────────────────────────────
// Agent Card
// ──────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: EliteAgent;
  index: number;
  /** Projects the current founder owns — determines recruit capability */
  founderProjects?: { id: string; name: string }[];
  /** Whether the current user can recruit (e.g. is founder) */
  canRecruit?: boolean;
  /** Default role for the invite */
  defaultRoleToInvite?: string;
  /** Callback after successful invite */
  onInvited?: (targetWallet: string) => void;
}

export function AgentCard({
  agent,
  index,
  founderProjects,
  canRecruit = false,
  defaultRoleToInvite = "member",
  onInvited,
}: AgentCardProps) {
  const displayScore = Math.min(98, agent.trustScore + 5);

  const { publicKey, signMessage, connected } = useWallet();
  const [inviteState, setInviteState] = useState<InviteState>("idle");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const recruitBtnRef = useRef<HTMLButtonElement>(null);

  const projects = founderProjects ?? [];
  const showRecruit = canRecruit && projects.length > 0;

  const closeMenu = useCallback(() => {
    setShowProjectMenu(false);
    setMenuAnchorRect(null);
  }, []);

  const handleRecruit = useCallback(
    async (targetProjectId: string) => {
      if (!publicKey || !signMessage) return;

      const founderWallet = publicKey.toBase58();
      const targetWallet = agent.address.trim();

      if (founderWallet === targetWallet) {
        setInviteError("Cannot recruit yourself.");
        setInviteState("error");
        return;
      }

      setInviteState("signing");
      setInviteError(null);

      try {
        const nonce = createNonceBase58();
        const timestamp = Date.now();

        const payload: PumpMatchPayload = {
          action: "invite",
          chain: "solana-mainnet",
          domain: "pumpmatch-governance",
          env:
            process.env.NODE_ENV === "production"
              ? "production"
              : "development",
          nonce,
          project: targetProjectId,
          role: defaultRoleToInvite,
          target: targetWallet,
          timestamp,
          v: 1,
        };

        const messageBytes = generateCanonicalMessageV1(payload);

        let signatureBytes: Uint8Array;
        try {
          signatureBytes = await signMessage(messageBytes);
        } catch {
          setInviteState("idle");
          return;
        }

        setInviteState("sending");

        const result = await addSquadMemberAction({
          projectId: targetProjectId,
          targetWallet,
          founderWallet,
          role: defaultRoleToInvite,
          nonce,
          timestamp,
          signature: bs58.encode(signatureBytes),
        });

        if (result.success) {
          setInviteState("success");
          onInvited?.(targetWallet);
        } else {
          setInviteError(result.message || "Invite failed.");
          setInviteState("error");
        }
      } catch (err) {
        console.error("[AgentCard] Recruit error:", err);
        setInviteError("Unexpected error.");
        setInviteState("error");
      }
    },
    [publicKey, signMessage, agent.address, defaultRoleToInvite, onInvited],
  );

  const handleRecruitClick = useCallback(() => {
    if (projects.length === 1) {
      handleRecruit(projects[0].id);
      return;
    }
    // Multi-project: toggle dropdown
    if (showProjectMenu) {
      closeMenu();
    } else {
      const rect = recruitBtnRef.current?.getBoundingClientRect();
      if (rect) {
        setMenuAnchorRect(rect);
        setShowProjectMenu(true);
      }
    }
  }, [projects, handleRecruit, showProjectMenu, closeMenu]);

  const recruitLabel = () => {
    switch (inviteState) {
      case "signing":
        return (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sign...
          </>
        );
      case "sending":
        return (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sending...
          </>
        );
      case "success":
        return (
          <>
            <Check className="h-3.5 w-3.5" />
            Invited
          </>
        );
      case "error":
        return (
          <>
            <AlertTriangle className="h-3.5 w-3.5" />
            Retry
          </>
        );
      default:
        return (
          <>
            Recruit
            {projects.length > 1 && (
              <ChevronDown className="h-3 w-3 ml-0.5" />
            )}
          </>
        );
    }
  };

  const isBusy =
    inviteState === "signing" ||
    inviteState === "sending" ||
    inviteState === "success";

  const isRecruitDisabled = isBusy || !connected;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: "easeOut",
        delay: index * 0.06,
      }}
      className={`pm-card pm-glow-purple relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 md:p-5 group ${getCardStyle(agent.rank)}`}
    >
      {/* Identity row: Rank + Avatar + Info */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 border-b border-slate-800/50 pb-3 sm:border-b-0 sm:pb-0">
        <RankIcon rank={agent.rank} />

        <div
          className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0 ring-2 ring-white/10"
          style={{ backgroundColor: generateAvatarColor(agent.username) }}
        >
          {agent.username.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-100 truncate">
              {agent.username}
            </span>
            {agent.identityState === "VERIFIED" && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-600 font-mono">
            {formatAddress(agent.address)}
          </span>
        </div>
      </div>

      {/* Trust Score + Network Bonus */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-4 flex-shrink-0 sm:pl-2">
        <div className="relative bg-slate-800/50 rounded-xl px-3 py-2.5 sm:bg-transparent sm:p-0 sm:rounded-none sm:text-right overflow-hidden">
          {/* Intel Radar shimmer — only on hover, no constant pulse */}
          <div className="absolute inset-0 rounded-xl pointer-events-none sm:hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/10 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-[opacity] duration-300" />
          </div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 sm:hidden">
            Trust Score
          </p>
          <span
            className={`text-lg sm:text-2xl font-black tabular-nums tracking-tighter leading-none ${
              displayScore >= 80
                ? "text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                : displayScore >= 50
                  ? "text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]"
                  : "text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.3)]"
            }`}
          >
            {displayScore}
          </span>
          <p className="hidden sm:block text-[8px] uppercase tracking-[0.15em] text-slate-600 mt-0.5">
            Trust
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-xl px-3 py-2.5 sm:bg-transparent sm:p-0 sm:rounded-none sm:text-right">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 sm:hidden">
            Network
          </p>
          <p className="text-sm font-mono tabular-nums text-emerald-400 sm:text-[9px] font-bold sm:mt-0.5">
            +5 Bonus
          </p>
        </div>

        {/* Recruit CTA */}
        {showRecruit ? (
          <button
            ref={recruitBtnRef}
            onClick={handleRecruitClick}
            disabled={isRecruitDisabled}
            className={`col-span-2 sm:col-auto inline-flex items-center justify-center gap-1.5 border rounded-xl px-4 py-2 min-h-[44px] text-xs font-semibold transition-[background-color,border-color,box-shadow,transform] duration-200 active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              inviteState === "success"
                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                : inviteState === "error"
                  ? "border-rose-500/30 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10"
                  : "border-purple-500/30 text-purple-300 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/55 hover:shadow-[0_0_14px_rgba(168,85,247,0.12)]"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {recruitLabel()}
          </button>
        ) : (
          <button
            className="col-span-2 sm:col-auto border border-purple-500/30 text-purple-300 bg-purple-500/5 rounded-xl px-4 py-2 min-h-[44px] text-xs font-semibold opacity-50 cursor-not-allowed"
            disabled
            title="Claim a project to recruit agents"
          >
            Recruit
          </button>
        )}
      </div>

      {/* Portal dropdown for multi-project selection */}
      {showProjectMenu && menuAnchorRect && (
        <PortalDropdown
          anchorRect={menuAnchorRect}
          items={projects}
          onSelect={handleRecruit}
          onClose={closeMenu}
        />
      )}

      {/* Invite error tooltip */}
      {inviteError && inviteState === "error" && (
        <p className="text-[10px] text-rose-400 sm:absolute sm:right-5 sm:bottom-1.5">
          {inviteError}
        </p>
      )}

      {/* Rank 1 ambient glow */}
      {agent.rank === 1 && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-400/[0.03] via-transparent to-yellow-400/[0.03] pointer-events-none" />
      )}
    </motion.div>
  );
}
