"use client";

import { useEffect } from "react";
import { X, ShieldAlert, Wallet } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SquadCommandCenter } from "./SquadCommandCenter";

type SquadMemberStatus =
  | "active"
  | "pending_invite"
  | "pending_application"
  | "rejected"
  | "revoked"
  | "kicked"
  | "left";

type SquadMember = {
  id: string;
  wallet_address?: string;
  walletAddress?: string;
  role?: string;
  status: SquadMemberStatus;
  joined_at?: string;
  joinedAt?: string;
};

interface ManageSquadModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    name: string;
    created_by_wallet: string;
  };
  currentUserWallet?: string | null;
  members: SquadMember[];
  onRefresh: () => void;
}

function maskWallet(address?: string | null) {
  if (!address || address.length < 10) return "Unknown";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function getMemberWallet(m: SquadMember): string {
  return (m.walletAddress ?? m.wallet_address ?? "").trim();
}

export default function ManageSquadModal({
  isOpen,
  onClose,
  project,
  currentUserWallet,
  members,
  onRefresh,
}: ManageSquadModalProps) {
  // Wallet-adapter is the source-of-truth for the acting wallet
  const { publicKey } = useWallet();
  const actorWallet = publicKey?.toBase58() ?? null;

  // Resolve the effective wallet: prefer live adapter, fall back to prop
  const effectiveWallet = (actorWallet ?? currentUserWallet ?? "").trim();

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add("overflow-hidden");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("overflow-hidden");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const founderWallet = project.created_by_wallet.trim();
  const isFounder = effectiveWallet.length > 0 && effectiveWallet === founderWallet;

  const myMembership = effectiveWallet
    ? members.find((m) => getMemberWallet(m) === effectiveWallet)
    : null;

  const myRole = isFounder
    ? "Founder"
    : myMembership
    ? (myMembership.role ?? "Member")
    : "Guest";

  const isDisconnected = !actorWallet && !currentUserWallet;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700/80 bg-slate-950 shadow-2xl shadow-emerald-500/10 animate-in zoom-in-95 duration-200 overflow-hidden">

        {/* MODAL HEADER */}
        <div className="flex items-start justify-between border-b border-slate-800 bg-slate-900/50 p-5 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Command Center: <span className="text-emerald-400">{project.name}</span>
            </h2>
            {effectiveWallet && (
              <div className="mt-2 flex items-center gap-3 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded">
                  👤 {maskWallet(effectiveWallet)}
                </span>
                <span className="flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded uppercase tracking-wider text-[10px]">
                  {myRole}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isDisconnected ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                <Wallet className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-200">Wallet Disconnected</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-sm">
                Please connect your wallet to view and manage your squad transitions.
              </p>
            </div>
          ) : (
            <>
              {/* Signature requirement notice */}
              <div className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                <ShieldAlert className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-200">Signature Verification Required</p>
                  <p className="text-xs text-slate-400 mt-1">
                    This action requires a wallet signature to confirm it&apos;s really you. Your request will be verified by the protocol.
                  </p>
                </div>
              </div>

              <SquadCommandCenter
                projectId={project.id}
                isFounder={isFounder}
                currentUserWallet={effectiveWallet}
                members={members}
                onRefresh={onRefresh}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
