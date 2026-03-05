"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import {
  ShieldCheck,
  XCircle,
  CheckCircle2,
  UserMinus,
  Clock,
  Users,
  ShieldAlert,
  Loader2,
  LogOut,
  Rocket,
} from "lucide-react";
import { executeSquadTransitionAction, joinSquadAction } from "@/app/actions/arena";
import {
  generateCanonicalMessageV1,
  generateCanonicalMessageV2,
  type PumpMatchPayload,
  type SquadTransitionPayloadV2,
} from "@/lib/signature-shared";

type SquadStatus =
  | "pending_invite"
  | "pending_application"
  | "active"
  | "rejected"
  | "revoked"
  | "kicked"
  | "left";

type ActionType =
  | "approve_app"
  | "reject_app"
  | "accept_invite"
  | "reject_invite"
  | "revoke_invite"
  | "kick"
  | "leave";

type SquadMember = {
  id: string;
  wallet_address?: string;
  walletAddress?: string;
  role?: string;
  status: SquadStatus;
  joined_at?: string;
  joinedAt?: string;
};

interface SquadCommandCenterProps {
  projectId: string;
  isFounder: boolean;
  currentUserWallet: string;
  members: SquadMember[];
  onRefresh: () => void;
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DOMAIN = "pumpmatch-governance" as const;
const CHAIN = "solana-mainnet" as const;

function maskWallet(address: string) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function getMemberWallet(m: SquadMember): string {
  return (m.walletAddress ?? m.wallet_address ?? "").trim();
}

function createNonceBase58(bytesLen = 16): string {
  const b = new Uint8Array(bytesLen);
  crypto.getRandomValues(b);
  return bs58.encode(b);
}

function sanitizeRole(input: string): { ok: boolean; value: string } {
  const v = input.trim().slice(0, 32);
  if (!v) return { ok: false, value: v };
  if (!/^[\p{L}\p{N} _-]{1,32}$/u.test(v)) return { ok: false, value: v };
  return { ok: true, value: v };
}

export function SquadCommandCenter({
  projectId,
  isFounder,
  currentUserWallet,
  members,
  onRefresh,
}: SquadCommandCenterProps) {
  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roleInput, setRoleInput] = useState("");

  const { publicKey, signMessage, connected } = useWallet();
  const actorWallet = publicKey?.toBase58() ?? null;
  const uiWallet = (actorWallet ?? currentUserWallet ?? "").trim();

  const isBusy = processingKey !== null;
  const canSign = Boolean(actorWallet && signMessage);

  // Memory leak guard
  const isMounted = useRef(true);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const showError = useCallback((msg: string) => {
    if (!isMounted.current) return;
    setErrorMsg(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      if (isMounted.current) setErrorMsg(null);
    }, 4000);
  }, []);

  const myMember = useMemo(() => {
    if (!uiWallet) return null;
    return members.find((m) => getMemberWallet(m) === uiWallet) ?? null;
  }, [members, uiWallet]);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members],
  );

  const pendingRequests = useMemo(
    () => members.filter((m) => m.status === "pending_application" || m.status === "pending_invite"),
    [members],
  );

  const isPendingApplication = myMember?.status === "pending_application";
  const isGuest = !isFounder && !myMember;

  // ── V1 Apply Handler ──
  const handleApply = useCallback(async () => {
    if (!actorWallet || !signMessage) {
      showError("Wallet not connected or doesn't support signing.");
      return;
    }
    const roleCheck = sanitizeRole(roleInput);
    if (!roleCheck.ok) {
      showError("Invalid role. Use letters/numbers/space/_/- (max 32).");
      return;
    }

    const nonce = createNonceBase58(16);
    const timestamp = Date.now();
    const env = process.env.NODE_ENV === "production" ? "production" : "development";

    const payloadV1: PumpMatchPayload = {
      action: "apply",
      chain: CHAIN,
      domain: DOMAIN,
      env,
      nonce,
      project: projectId.trim(),
      role: roleCheck.value,
      target: actorWallet,
      timestamp,
      v: 1,
    };

    const key = `apply:${actorWallet}`;
    setProcessingKey(key);
    setErrorMsg(null);

    try {
      const messageBytes = generateCanonicalMessageV1(payloadV1);
      const signatureBase58 = bs58.encode(await signMessage(messageBytes));

      const result = await joinSquadAction({
        projectId: payloadV1.project,
        walletAddress: actorWallet,
        role: payloadV1.role,
        nonce: payloadV1.nonce,
        timestamp: payloadV1.timestamp,
        signature: signatureBase58,
      });

      if (!isMounted.current) return;

      if (result?.success) {
        setRoleInput("");
        onRefresh();
        setActiveTab("pending");
      } else {
        showError(result?.message || "Apply failed.");
      }
    } catch (e) {
      console.error("Apply failed:", e);
      if (!isMounted.current) return;
      showError("Signature rejected or network error.");
    } finally {
      if (isMounted.current) setProcessingKey((cur) => (cur === key ? null : cur));
    }
  }, [actorWallet, signMessage, roleInput, projectId, onRefresh, showError]);

  // ── V2 Transition Handler ──
  const handleTransition = useCallback(
    async (targetWalletRaw: string, actionType: ActionType, memberId: string) => {
      if (!actorWallet || !signMessage) {
        showError("Wallet not connected or doesn't support signing.");
        return;
      }

      const targetWallet = targetWalletRaw.trim();
      if (!BASE58_RE.test(targetWallet)) {
        showError("Invalid target wallet address.");
        return;
      }

      const key = `${actionType}:${memberId}`;
      setProcessingKey(key);
      setErrorMsg(null);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);

      try {
        const nonce = createNonceBase58(16);
        const timestamp = Date.now();

        const payloadObj: SquadTransitionPayloadV2 = {
          v: 2,
          domain: DOMAIN,
          chain: CHAIN,
          projectId: projectId.trim(),
          actorWallet,
          targetWallet,
          actionType,
          nonce,
          timestamp,
        };

        const messageBytes = generateCanonicalMessageV2(payloadObj);
        const signatureBase58 = bs58.encode(await signMessage(messageBytes));

        const result = await executeSquadTransitionAction({
          projectId: payloadObj.projectId,
          actorWallet: payloadObj.actorWallet,
          targetWallet: payloadObj.targetWallet,
          actionType: payloadObj.actionType as ActionType,
          nonce: payloadObj.nonce,
          timestamp: payloadObj.timestamp,
          signature: signatureBase58,
        });

        if (!isMounted.current) return;

        if (result?.success) {
          onRefresh();
        } else {
          showError(result?.message || "Protocol transition failed.");
        }
      } catch (e) {
        console.error("Transition failed:", e);
        if (!isMounted.current) return;
        showError("Transaction rejected by user or network error.");
      } finally {
        if (isMounted.current) setProcessingKey((cur) => (cur === key ? null : cur));
      }
    },
    [actorWallet, projectId, signMessage, onRefresh, showError],
  );

  return (
    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Wallet gating */}
      {!connected || !actorWallet ? (
        <div className="p-4 text-sm text-slate-300">
          Connect your wallet to access the Command Center.
        </div>
      ) : null}

      {connected && actorWallet && !canSign ? (
        <div className="p-4 text-sm text-slate-300">
          Your wallet does not support message signing. Actions are disabled.
        </div>
      ) : null}

      {/* Guest Apply Panel */}
      {connected && canSign && isGuest && (
        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <Rocket className="w-4 h-4" />
            Apply to Squad
          </div>

          <div className="mt-2">
            <label className="block text-[11px] text-slate-400 uppercase tracking-wider font-medium">
              Desired Role
            </label>
            <input
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              placeholder="Developer, Marketing, Advisor..."
              maxLength={32}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors"
            />
          </div>

          <button
            type="button"
            disabled={isBusy || !sanitizeRole(roleInput).ok}
            onClick={() => void handleApply()}
            className="mt-3 w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {processingKey?.startsWith("apply:") ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Signing...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" /> Apply
              </>
            )}
          </button>

          <p className="mt-2 text-[11px] text-slate-500">
            Signing required. Your application will appear as pending.
          </p>
        </div>
      )}

      {/* Pending Application Radar (for applicants) */}
      {connected && canSign && isPendingApplication && (
        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
          <div className="relative overflow-hidden rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="absolute inset-0 opacity-40 pointer-events-none">
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-500/20 animate-pulse" />
              <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-500/10 animate-pulse" />
            </div>
            <div className="relative">
              <div className="text-sm font-semibold text-purple-200">Application Under Review</div>
              <div className="mt-1 text-xs text-slate-300">
                Your application is being reviewed by the Founder.
              </div>
              {myMember?.role && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                  <Clock className="w-3 h-3" /> Applied as: {myMember.role}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex items-center border-b border-slate-800 bg-slate-900/80 px-4 pt-4 gap-6">
        <button
          onClick={() => setActiveTab("active")}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === "active" ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Active Squad ({activeMembers.length})
          </span>
          {activeTab === "active" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full shadow-[0_-2px_8px_rgba(16,185,129,0.5)]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("pending")}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === "pending" ? "text-amber-400" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pending Requests
            {pendingRequests.length > 0 && (
              <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full ml-1 tabular-nums">
                {pendingRequests.length}
              </span>
            )}
          </span>
          {activeTab === "pending" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 rounded-t-full shadow-[0_-2px_8px_rgba(245,158,11,0.5)]" />
          )}
        </button>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mx-4 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-xs break-words">
          <ShieldAlert className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Tab Content */}
      <div className="p-4 max-h-[50vh] overflow-y-auto">
        {activeTab === "active" && (
          <div className="space-y-3">
            {activeMembers.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No active members yet.</div>
            ) : (
              activeMembers.map((member) => {
                const w = getMemberWallet(member);
                const isMe = w === uiWallet;
                const kickKey = `kick:${member.id}`;
                const leaveKey = `leave:${member.id}`;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-mono text-slate-200 tabular-nums">{maskWallet(w)}</p>
                        <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                          {member.role ?? "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isFounder && !isMe && (
                        <button
                          type="button"
                          onClick={() => void handleTransition(w, "kick", member.id)}
                          disabled={isBusy || !canSign}
                          className={`p-2 rounded-lg transition-colors group relative ${
                            processingKey === kickKey
                              ? "text-rose-400"
                              : "text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                          } disabled:opacity-50`}
                          title="Kick Member"
                        >
                          {processingKey === kickKey ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserMinus className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {!isFounder && isMe && (
                        <button
                          type="button"
                          onClick={() => void handleTransition(w, "leave", member.id)}
                          disabled={isBusy || !canSign}
                          className={`px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 ${
                            processingKey === leaveKey
                              ? "text-slate-400 border-slate-600 cursor-not-allowed"
                              : "text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                          } disabled:opacity-50`}
                        >
                          {processingKey === leaveKey ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <LogOut className="w-3.5 h-3.5" />
                          )}
                          Leave Squad
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "pending" && (
          <div className="space-y-3">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No pending requests.</div>
            ) : (
              pendingRequests.map((member) => {
                const w = getMemberWallet(member);
                const isApplication = member.status === "pending_application";
                const isInvite = member.status === "pending_invite";
                const isMe = w === uiWallet;

                const canApproveApp = isFounder && isApplication;
                const canRevokeInvite = isFounder && isInvite;
                const canAcceptInvite = !isFounder && isMe && isInvite;

                if (!isFounder && !isMe) return null;

                const rejectAppKey = `reject_app:${member.id}`;
                const approveAppKey = `approve_app:${member.id}`;
                const revokeKey = `revoke_invite:${member.id}`;
                const rejectInvKey = `reject_invite:${member.id}`;
                const acceptInvKey = `accept_invite:${member.id}`;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-amber-500/20 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-mono text-slate-200 tabular-nums">
                          {isMe ? "You" : maskWallet(w)}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                            {member.role ?? "—"}
                          </span>
                          <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                          <span className="text-[10px] text-amber-400">
                            {isApplication ? "Applied to join" : "Invited by founder"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canApproveApp && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleTransition(w, "reject_app", member.id)}
                            disabled={isBusy || !canSign}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {processingKey === rejectAppKey ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTransition(w, "approve_app", member.id)}
                            disabled={isBusy || !canSign}
                            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 ${
                              processingKey === approveAppKey
                                ? "text-slate-400 border-slate-600 cursor-not-allowed"
                                : "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                            } disabled:opacity-50`}
                          >
                            {processingKey === approveAppKey ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}{" "}
                            Approve
                          </button>
                        </>
                      )}

                      {canRevokeInvite && (
                        <button
                          type="button"
                          onClick={() => void handleTransition(w, "revoke_invite", member.id)}
                          disabled={isBusy || !canSign}
                          className={`px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 ${
                            processingKey === revokeKey
                              ? "text-slate-400 border-slate-600 cursor-not-allowed"
                              : "text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                          } disabled:opacity-50`}
                        >
                          {processingKey === revokeKey ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}{" "}
                          Revoke Invite
                        </button>
                      )}

                      {canAcceptInvite && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleTransition(w, "reject_invite", member.id)}
                            disabled={isBusy || !canSign}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {processingKey === rejectInvKey ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTransition(w, "accept_invite", member.id)}
                            disabled={isBusy || !canSign}
                            className={`px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 ${
                              processingKey === acceptInvKey
                                ? "text-slate-400 border-slate-600 cursor-not-allowed"
                                : "text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                            } disabled:opacity-50`}
                          >
                            {processingKey === acceptInvKey ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}{" "}
                            Accept Invite
                          </button>
                        </>
                      )}

                      {!isFounder && isMe && isApplication && (
                        <span className="text-[10px] text-amber-500/70 italic px-2">Awaiting founder...</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
