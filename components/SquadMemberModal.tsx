"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2, UserPlus, UserMinus, Users, ShieldCheck } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  getSquadMembersAction,
  addSquadMemberAction,
  joinSquadAction,
  removeSquadMemberAction,
} from "@/app/actions/arena";
import type { Role, SquadMember } from "@/types";

interface SquadMemberModalProps {
  projectId: string;
  projectName: string;
  /** Founder wallet address — if caller matches, show founder controls */
  founderWallet: string;
  /** The current connected wallet */
  walletAddress: string;
  isOpen: boolean;
  onClose: () => void;
}

const VALID_ROLES: Role[] = ["Dev", "Artist", "Marketing", "Whale", "Community"];

export function SquadMemberModal({
  projectId,
  projectName,
  founderWallet,
  walletAddress,
  isOpen,
  onClose,
}: SquadMemberModalProps) {
  const { signMessage } = useWallet();
  const isFounder = walletAddress === founderWallet;

  const [members, setMembers] = useState<SquadMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [addWallet, setAddWallet] = useState("");
  const [addRole, setAddRole] = useState<Role | "">("");
  const [isAdding, setIsAdding] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const result = await getSquadMembersAction(projectId);
    setMembers(result);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      setAddWallet("");
      setAddRole("");
      setActionError(null);
      setActionSuccess(null);
    }
  }, [isOpen, fetchMembers]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => { if (e.target === backdropRef.current) onClose(); },
    [onClose],
  );

  async function buildSignedMessage(action: string): Promise<{ message: string; signature: string } | null> {
    if (!signMessage) return null;
    const message = `Pump Match Squad ${action}\nProject: ${projectId}\nCaller: ${walletAddress}\nTimestamp: ${Date.now()}`;
    const bytes = new TextEncoder().encode(message);
    const sigBytes = await signMessage(bytes);
    const signature = btoa(String.fromCharCode(...sigBytes));
    return { message, signature };
  }

  async function handleAddMember() {
    const target = addWallet.trim();
    if (!target) return;
    setIsAdding(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const signed = await buildSignedMessage("Add Member");
      if (!signed) { setActionError("Wallet signing not available."); return; }
      const result = await addSquadMemberAction(
        projectId, target, walletAddress, addRole as Role || undefined, signed,
      );
      if (result.success) {
        setActionSuccess(result.message);
        setAddWallet("");
        setAddRole("");
        await fetchMembers();
      } else {
        setActionError(result.message);
      }
    } catch {
      setActionError("Action failed. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleJoinSquad() {
    setIsJoining(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const signed = await buildSignedMessage("Join");
      if (!signed) { setActionError("Wallet signing not available."); return; }
      const result = await joinSquadAction(projectId, walletAddress, addRole as Role || undefined, signed);
      if (result.success) {
        setActionSuccess(result.message);
        await fetchMembers();
      } else {
        setActionError(result.message);
      }
    } catch {
      setActionError("Action failed. Please try again.");
    } finally {
      setIsJoining(false);
    }
  }

  async function handleRemoveMember(memberWallet: string) {
    try {
      const signed = await buildSignedMessage("Remove Member");
      if (!signed) return;
      const result = await removeSquadMemberAction(projectId, memberWallet, walletAddress, signed);
      if (result.success) {
        setActionSuccess(result.message);
        await fetchMembers();
      } else {
        setActionError(result.message);
      }
    } catch {
      setActionError("Remove failed. Please try again.");
    }
  }

  const isMember = members.some((m) => m.walletAddress === walletAddress && m.status === 'active');
  const hasPendingApp = members.some((m) => m.walletAddress === walletAddress && m.status === 'pending');

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700/60 bg-zinc-900/95 backdrop-blur-xl shadow-xl animate-in zoom-in-95 fade-in duration-200 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-400" />
              {projectName} — Squad
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFounder ? "Manage your team" : "Apply to join this squad"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Action feedback */}
          {actionSuccess && (
            <div className="px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300">
              {actionSuccess}
            </div>
          )}
          {actionError && (
            <div className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-sm text-rose-400">
              {actionError}
            </div>
          )}

          {/* Member list */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-3">
              Members ({members.filter(m => m.status === 'active').length})
            </p>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : members.filter(m => m.status === 'active').length === 0 ? (
              <p className="text-sm text-slate-600 italic">No active members yet.</p>
            ) : (
              <div className="space-y-2">
                {members.filter(m => m.status === 'active').map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {member.walletAddress === founderWallet && (
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" aria-label="Founder" />
                      )}
                      <span className="text-sm text-slate-300 font-mono truncate">
                        {member.displayAddress}
                      </span>
                      {member.role && (
                        <span className="text-[10px] text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 flex-shrink-0">
                          {member.role}
                        </span>
                      )}
                    </div>
                    {/* Founder can remove anyone; member can remove themselves */}
                    {(isFounder || member.walletAddress === walletAddress) &&
                      member.walletAddress !== founderWallet && (
                      <button
                        onClick={() => handleRemoveMember(member.walletAddress)}
                        className="ml-2 p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"
                        title="Remove member"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pending applications (founder only) */}
            {isFounder && members.filter(m => m.status === 'pending').length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-2">
                  Pending Applications
                </p>
                <div className="space-y-2">
                  {members.filter(m => m.status === 'pending').map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
                    >
                      <span className="text-sm text-slate-300 font-mono">{member.displayAddress}</span>
                      <button
                        onClick={async () => {
                          // Accept: re-add with active status (remove pending, add active)
                          await handleRemoveMember(member.walletAddress);
                          const signed = await buildSignedMessage("Accept Member");
                          if (signed) {
                            await addSquadMemberAction(
                              projectId, member.walletAddress, walletAddress,
                              member.role, signed,
                            );
                            await fetchMembers();
                          }
                        }}
                        className="text-xs px-2 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        Accept
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Add member (founder only) */}
          {isFounder && (
            <div className="border-t border-slate-800 pt-5">
              <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-3">
                Add Member by Wallet
              </p>
              <div className="space-y-2">
                <input
                  type="text"
                  value={addWallet}
                  onChange={(e) => setAddWallet(e.target.value)}
                  placeholder="Solana wallet address"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors font-mono"
                />
                <div className="flex gap-2">
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as Role | "")}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/60 transition-colors"
                  >
                    <option value="">Role (optional)</option>
                    {VALID_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddMember}
                    disabled={!addWallet.trim() || isAdding}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Join squad (non-founders who are not yet members) */}
          {!isFounder && !isMember && !hasPendingApp && (
            <div className="border-t border-slate-800 pt-5">
              <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-3">
                Apply to Join
              </p>
              <div className="flex gap-2">
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as Role | "")}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/60 transition-colors"
                >
                  <option value="">My Role (optional)</option>
                  {VALID_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button
                  onClick={handleJoinSquad}
                  disabled={isJoining}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Apply
                </button>
              </div>
            </div>
          )}

          {!isFounder && hasPendingApp && (
            <div className="border-t border-slate-800 pt-4">
              <p className="text-sm text-amber-400/70 italic">Application pending founder approval.</p>
            </div>
          )}
          {!isFounder && isMember && (
            <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
              <p className="text-sm text-emerald-400">You are an active member.</p>
              <button
                onClick={() => handleRemoveMember(walletAddress)}
                className="text-xs px-2 py-1 rounded border border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/15 transition-colors"
              >
                Leave Squad
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
