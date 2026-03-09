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

function signalLabel(score: number) {
  if (score >= 80) return "High Signal";
  if (score >= 50) return "Mid Signal";
  return "Early Signal";
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-yellow-300 via-amber-400 to-yellow-600 shadow-lg shadow-yellow-500/50 ring-2 ring-yellow-400/40">
        <Crown className="h-5 w-5 text-yellow-950" />
      </div>
    );
  }

  if (rank === 2) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-slate-200 via-slate-300 to-slate-400 shadow-lg shadow-slate-400/40 ring-2 ring-slate-300/30">
        <Trophy className="h-4 w-4 text-slate-700" />
      </div>
    );
  }

  if (rank === 3) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-orange-400 via-amber-500 to-orange-600 shadow-lg shadow-orange-500/40 ring-2 ring-orange-400/30">
        <Medal className="h-4 w-4 text-orange-100" />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/60 bg-slate-800/70">
      <span className="text-sm font-bold tabular-nums text-slate-400">
        {rank}
      </span>
    </div>
  );
}

function getCardStyle(rank: number): string {
  if (rank === 1) {
    return "scale-[1.02] border-yellow-400/50 bg-linear-to-br from-yellow-500/10 to-transparent shadow-[0_0_30px_-5px_rgba(250,204,21,0.2)] hover:shadow-[0_0_36px_-5px_rgba(250,204,21,0.28)]";
  }

  if (rank === 2) {
    return "border-slate-300/40 bg-linear-to-br from-slate-400/5 to-transparent shadow-[0_0_20px_-5px_rgba(148,163,184,0.15)]";
  }

  if (rank === 3) {
    return "border-orange-400/40 bg-linear-to-br from-orange-500/5 to-transparent shadow-[0_0_20px_-5px_rgba(251,146,60,0.15)]";
  }

  return "";
}

type InviteState = "idle" | "signing" | "sending" | "success" | "error";

interface PortalDropdownProps {
  anchorRect: DOMRect;
  items: { id: string; name: string }[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

function PortalDropdown({
  anchorRect,
  items,
  onSelect,
  onClose,
}: PortalDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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
        className="z-50 rounded-2xl border border-purple-500/25 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl"
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
    document.body
  );
}

interface AgentCardProps {
  agent: EliteAgent;
  index: number;
  founderProjects?: { id: string; name: string }[];
  canRecruit?: boolean;
  defaultRoleToInvite?: string;
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
    [publicKey, signMessage, agent.address, defaultRoleToInvite, onInvited]
  );

  const handleRecruitClick = useCallback(() => {
    if (projects.length === 1) {
      handleRecruit(projects[0].id);
      return;
    }

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
            {projects.length > 1 ? (
              <ChevronDown className="ml-0.5 h-3 w-3" />
            ) : null}
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
      className={`pm-card pm-glow-purple group relative flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4 md:p-5 ${getCardStyle(
        agent.rank
      )}`}
    >
      <div className="min-w-0 flex-1 border-b border-slate-800/50 pb-3 sm:border-b-0 sm:pb-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <RankIcon rank={agent.rank} />

          <div
            className="h-11 w-11 shrink-0 rounded-full ring-2 ring-white/10 shadow-lg"
            style={{ backgroundColor: generateAvatarColor(agent.username) }}
          >
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
              {agent.username.charAt(0).toUpperCase()}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-slate-100">
                {agent.username}
              </span>

              {agent.identityState === "VERIFIED" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/30 bg-slate-800/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </span>
              ) : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-slate-500">
                {formatAddress(agent.address)}
              </span>
              <span className="rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                {signalLabel(displayScore)}
              </span>
            </div>

            <div className="min-w-0 flex-1">
  <div className="flex items-center gap-2">
    <span className="truncate text-sm font-bold text-slate-100">
      {agent.username}
    </span>

    {agent.identityState === "VERIFIED" ? (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/30 bg-slate-800/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-300">
        <ShieldCheck className="h-3 w-3" />
        Verified
      </span>
    ) : null}
  </div>

  <div className="mt-1 flex flex-wrap items-center gap-2">
    <span className="font-mono text-[11px] text-slate-500">
      {formatAddress(agent.address)}
    </span>
    <span className="rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-400">
      {signalLabel(displayScore)}
    </span>
  </div>
</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-4 sm:pl-2">
        <div className="rounded-xl bg-slate-800/50 px-3 py-2.5 sm:min-w-[92px] sm:bg-transparent sm:p-0 sm:text-right">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500 sm:hidden">
            Public Signal Surface
          </p>

          <span
            className={`text-lg font-black leading-none tracking-tighter tabular-nums sm:text-2xl ${
              displayScore >= 80
                ? "text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.45)]"
                : displayScore >= 50
                ? "text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]"
                : "text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.24)]"
            }`}
          >
            {displayScore}
          </span>

          <p className="mt-0.5 hidden text-[8px] uppercase tracking-[0.16em] text-slate-600 sm:block">
            Public Signal Surface
          </p>
        </div>

        {showRecruit ? (
          <button
            ref={recruitBtnRef}
            onClick={handleRecruitClick}
            disabled={isRecruitDisabled}
            className={`col-span-2 sm:col-auto inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition-[background-color,border-color,box-shadow,transform] duration-200 active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              inviteState === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : inviteState === "error"
                ? "border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10"
                : "border-purple-500/30 bg-purple-500/5 text-purple-300 hover:border-purple-500/55 hover:bg-purple-500/10 hover:shadow-[0_0_14px_rgba(168,85,247,0.12)]"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {recruitLabel()}
          </button>
        ) : (
          <button
            className="col-span-2 sm:col-auto min-h-[44px] cursor-not-allowed rounded-xl border border-purple-500/30 bg-purple-500/5 px-4 py-2 text-xs font-semibold text-purple-300 opacity-50"
            disabled
            title="Claim a project to recruit agents"
          >
            Recruit
          </button>
        )}
      </div>

      {showProjectMenu && menuAnchorRect ? (
        <PortalDropdown
          anchorRect={menuAnchorRect}
          items={projects}
          onSelect={handleRecruit}
          onClose={closeMenu}
        />
      ) : null}

      {inviteError && inviteState === "error" ? (
        <p className="text-[10px] text-rose-400 sm:absolute sm:right-5 sm:bottom-1.5">
          {inviteError}
        </p>
      ) : null}

      {agent.rank === 1 ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-r from-yellow-400/3 via-transparent to-yellow-400/3" />
      ) : null}
    </motion.div>
  );
}