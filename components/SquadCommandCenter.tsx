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
  Settings2,
  Coins,
  PenLine,
  Lock,
  ChevronRight,
} from "lucide-react";
import { executeSquadTransitionAction, joinSquadAction } from "@/app/actions/arena";
import {
  generateCanonicalMessageV1,
  generateCanonicalMessageV2,
  type PumpMatchPayload,
  type SquadTransitionPayloadV2,
} from "@/lib/signature-shared";
import {
  upsertRoleSlots,
  updateSquadOpsStatus,
  createSplitProposal,
  signSplitProposal,
} from "@/app/actions/squad-os";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

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

export type OpsStatusValue =
  | "forming"
  | "recruiting"
  | "split_configured"
  | "ready_for_launch"
  | "launched";

export type RoleSlot = {
  id: string;
  role_type: string;
  capacity: number;
  min_trust: number | null;
};

export type SplitShare = { user_id: string; wallet: string; bps: number };

export type ActiveProposal =
  | {
      id: string;
      state: "draft" | "locked" | "superseded";
      shares: SplitShare[];
    }
  | null;

interface SquadCommandCenterProps {
  projectId: string;
  isFounder: boolean;
  currentUserWallet: string;
  members: SquadMember[];
  onRefresh: () => void;
  opsStatus?: OpsStatusValue;
  roleSlots?: RoleSlot[];
  activeProposal?: ActiveProposal;
  signedUserIds?: string[];
  currentUserId?: string;
}

// ──────────────────────────────────────────────────────────────
// Constants & Helpers
// ──────────────────────────────────────────────────────────────

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DOMAIN = "pumpmatch-governance" as const;
const CHAIN = "solana-mainnet" as const;

const OPS_STEPS: { key: OpsStatusValue; label: string }[] = [
  { key: "forming", label: "Forming" },
  { key: "recruiting", label: "Recruiting" },
  { key: "split_configured", label: "Split Configured" },
  { key: "ready_for_launch", label: "Ready for Launch" },
  { key: "launched", label: "Launched" },
];

const DEFAULT_ROLE_OPTIONS = ["DEV", "MKT", "ADVISOR", "OPS", "DESIGN"];

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

/** Sort object keys deterministically for signing */
function stableStringify(obj: Record<string, string | number | boolean | null>): string {
  const keys = Object.keys(obj).sort();
  const sorted: Record<string, string | number | boolean | null> = {};
  for (const k of keys) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

/** SHA-256 via Web Crypto, returns hex string */
async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(data) as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ──────────────────────────────────────────────────────────────
// Progress Bar
// ──────────────────────────────────────────────────────────────

function OpsProgressBar({ status }: { status: OpsStatusValue }) {
  const currentIdx = OPS_STEPS.findIndex((s) => s.key === status);

  const hints: Record<OpsStatusValue, string> = {
    forming: "Define role slots to start recruiting",
    recruiting: "Configure revenue split when team is ready",
    split_configured: "Collect signatures from all members",
    ready_for_launch: "Squad is verified and launch-ready",
    launched: "Squad is live",
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-1 mb-3">
        {OPS_STEPS.map((step, i) => {
          const isActive = i === currentIdx;
          const isCompleted = i < currentIdx;
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className="relative w-full">
                  <div
                    className={`w-full h-1.5 rounded-full transition-[background-color,box-shadow] duration-500 ${
                      isCompleted
                        ? "bg-emerald-500"
                        : isActive
                          ? "bg-emerald-500/60 shadow-[0_0_14px_rgba(16,185,129,0.18)] ring-1 ring-emerald-500/20"
                          : "bg-slate-800"
                    }`}
                  />
                  {isActive && (
                    <span className="absolute -top-0.5 right-0 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse motion-reduce:animate-none" />
                  )}
                </div>
                <span
                  className={`mt-1.5 text-[9px] font-semibold uppercase tracking-wider truncate transition-[color] duration-300 ${
                    isActive ? "text-emerald-400" : isCompleted ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < OPS_STEPS.length - 1 && (
                <ChevronRight
                  className={`h-3 w-3 shrink-0 mx-0.5 transition-[color] duration-300 ${
                    isCompleted ? "text-emerald-500" : "text-slate-700"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 italic tracking-wide">{hints[status]}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────

export function SquadCommandCenter({
  projectId,
  isFounder,
  currentUserWallet,
  members,
  onRefresh,
  opsStatus = "forming",
  roleSlots = [],
  activeProposal = null,
  signedUserIds = [],
  currentUserId,
}: SquadCommandCenterProps) {
  type TabKey = "members" | "slots" | "split";
  const [activeTab, setActiveTab] = useState<TabKey>("members");
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roleInput, setRoleInput] = useState("");

  const { publicKey, signMessage, connected } = useWallet();
  const actorWallet = publicKey?.toBase58() ?? null;
  const uiWallet = (actorWallet ?? currentUserWallet ?? "").trim();

  const isBusy = processingKey !== null;
  const canSign = Boolean(actorWallet && signMessage);

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

  // ── V1 Apply Handler (PRESERVED BYTE-FOR-BYTE) ──
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
        setActiveTab("members");
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

  // ── V2 Transition Handler (PRESERVED BYTE-FOR-BYTE) ──
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

  // ──────────────────────────────────────────────────────────────
  // Tab: Members & Recruiting (existing apply/pending/active lists)
  // ──────────────────────────────────────────────────────────────

  function MembersTab() {
    return (
      <>
        {/* Guest Apply Panel */}
        {connected && canSign && isGuest && (
          <div className="p-5 border-b border-slate-800/50 bg-slate-950/30">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <Rocket className="w-4 h-4 text-emerald-400" />
              Apply to Squad
            </div>
            <div className="mt-3">
              <label className="block text-[11px] text-slate-400 uppercase tracking-wider font-medium mb-1">
                Desired Role
              </label>
              <input
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                placeholder="Developer, Marketing, Advisor\u2026"
                maxLength={32}
                className="w-full rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 transition-[border-color] duration-200"
              />
            </div>
            <button
              type="button"
              disabled={isBusy || !sanitizeRole(roleInput).ok}
              onClick={() => void handleApply()}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold px-4 py-2.5 text-xs shadow-lg shadow-emerald-500/15 hover:from-emerald-400 hover:to-teal-400 active:scale-95 motion-reduce:active:scale-100 transition-[box-shadow,transform] duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              {processingKey?.startsWith("apply:") ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing...</>
              ) : (
                <><Rocket className="w-4 h-4" /> Apply</>
              )}
            </button>
            <p className="mt-2 text-[11px] text-slate-500">
              Signing required. Your application will appear as pending.
            </p>
          </div>
        )}

        {/* Pending Application Radar */}
        {connected && canSign && isPendingApplication && (
          <div className="p-5 border-b border-slate-800/50 bg-slate-950/30">
            <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-purple-500/5 backdrop-blur-sm p-4">
              <div className="absolute inset-0 opacity-30 pointer-events-none">
                <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-500/20 animate-pulse motion-reduce:animate-none" />
              </div>
              <div className="relative">
                <div className="text-sm font-semibold text-purple-200">Application Under Review</div>
                <div className="mt-1 text-xs text-slate-400">
                  Your application is being reviewed by the Founder.
                </div>
                {myMember?.role && (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-[10px] font-bold text-purple-300 uppercase tracking-wider shadow-[0_0_12px_rgba(168,85,247,0.1)]">
                    <Clock className="w-3 h-3" /> Applied as: {myMember.role}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Active Members */}
        <div className="p-4 space-y-3">
          <h3 className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">
            Active Squad ({activeMembers.length})
          </h3>
          {activeMembers.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-sm">No active members yet.</div>
          ) : (
            activeMembers.map((member) => {
              const w = getMemberWallet(member);
              const isMe = w === uiWallet;
              const kickKey = `kick:${member.id}`;
              const leaveKey = `leave:${member.id}`;
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-slate-900/35 backdrop-blur-md border border-slate-800/60 rounded-2xl hover:bg-slate-900/55 hover:border-slate-700/80 transition-[background-color,border-color] duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.08)]">
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
                        className={`p-2 rounded-xl transition-[background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 ${
                          processingKey === kickKey
                            ? "text-rose-400 bg-rose-500/10"
                            : "text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                        } disabled:opacity-50`}
                        aria-label="Kick member"
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
                        className={`px-3 py-1.5 text-xs border rounded-xl transition-[background-color,border-color] duration-200 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 ${
                          processingKey === leaveKey
                            ? "text-slate-400 border-slate-700/50 cursor-not-allowed"
                            : "text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/50"
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

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <>
              <h3 className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold mt-4 mb-2">
                Pending Requests ({pendingRequests.length})
              </h3>
              {pendingRequests.map((member) => {
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
                    className="flex items-center justify-between p-3 bg-slate-900/35 backdrop-blur-md border border-amber-500/20 rounded-2xl hover:border-amber-500/40 hover:bg-slate-900/50 transition-[background-color,border-color] duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.08)]">
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
                          <span className="w-1 h-1 bg-slate-600 rounded-full" />
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
                            aria-label="Reject application"
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-[background-color,color] duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
                          >
                            {processingKey === rejectAppKey ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTransition(w, "approve_app", member.id)}
                            disabled={isBusy || !canSign}
                            className={`px-3 py-1.5 text-xs border rounded-xl transition-[background-color,border-color] duration-200 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                              processingKey === approveAppKey
                                ? "text-slate-400 border-slate-700/50 cursor-not-allowed"
                                : "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                            } disabled:opacity-50`}
                          >
                            {processingKey === approveAppKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}{" "}
                            Approve
                          </button>
                        </>
                      )}
                      {canRevokeInvite && (
                        <button
                          type="button"
                          onClick={() => void handleTransition(w, "revoke_invite", member.id)}
                          disabled={isBusy || !canSign}
                          className={`px-3 py-1.5 text-xs border rounded-xl transition-[background-color,border-color] duration-200 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 ${
                            processingKey === revokeKey
                              ? "text-slate-400 border-slate-700/50 cursor-not-allowed"
                              : "text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/50"
                          } disabled:opacity-50`}
                        >
                          {processingKey === revokeKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}{" "}
                          Revoke Invite
                        </button>
                      )}
                      {canAcceptInvite && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleTransition(w, "reject_invite", member.id)}
                            disabled={isBusy || !canSign}
                            aria-label="Reject invite"
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-[background-color,color] duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
                          >
                            {processingKey === rejectInvKey ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTransition(w, "accept_invite", member.id)}
                            disabled={isBusy || !canSign}
                            className={`px-3 py-1.5 text-xs border rounded-xl transition-[background-color,border-color] duration-200 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 ${
                              processingKey === acceptInvKey
                                ? "text-slate-400 border-slate-700/50 cursor-not-allowed"
                                : "text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50"
                            } disabled:opacity-50`}
                          >
                            {processingKey === acceptInvKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}{" "}
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
              })}
            </>
          )}
        </div>
      </>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Tab: Role Slots
  // ──────────────────────────────────────────────────────────────

  function RoleSlotsTab() {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<Array<{ role_type: string; capacity: number; min_trust: number | null }>>(
      roleSlots.length > 0
        ? roleSlots.map((s) => ({ role_type: s.role_type, capacity: s.capacity, min_trust: s.min_trust }))
        : DEFAULT_ROLE_OPTIONS.slice(0, 3).map((r) => ({ role_type: r, capacity: 1, min_trust: 0 })),
    );
    const [slotError, setSlotError] = useState<string | null>(null);

    const handleAddSlot = () => {
      if (draft.length >= 10) return;
      setDraft((prev) => [...prev, { role_type: "", capacity: 1, min_trust: 0 }]);
    };

    const handleRemoveSlot = (idx: number) => {
      setDraft((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSaveSlots = async () => {
      if (!currentUserId) { setSlotError("Not authenticated."); return; }
      setSlotError(null);
      const key = "save_slots";
      setProcessingKey(key);
      try {
        const result = await upsertRoleSlots(projectId, currentUserId, draft);
        if (!isMounted.current) return;
        if (result.success) {
          setEditing(false);
          // Auto-advance to recruiting if currently forming
          if (opsStatus === "forming" && currentUserId) {
            await updateSquadOpsStatus(projectId, currentUserId, "recruiting");
          }
          onRefresh();
        } else {
          setSlotError(result.error ?? "Failed to save slots.");
        }
      } catch {
        if (isMounted.current) setSlotError("Failed to save role slots.");
      } finally {
        if (isMounted.current) setProcessingKey((cur) => (cur === key ? null : cur));
      }
    };

    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
            Role Slots ({roleSlots.length} defined)
          </h3>
          {isFounder && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-[color] duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/50 rounded"
            >
              <PenLine className="w-3 h-3" /> Edit Slots
            </button>
          )}
        </div>

        {slotError && (
          <div className="mb-3 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2 backdrop-blur-sm">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> {slotError}
          </div>
        )}

        {!editing ? (
          <div className="space-y-2">
            {roleSlots.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">
                {isFounder ? "No slots defined. Click Edit to configure roles." : "No role slots configured yet."}
              </div>
            ) : (
              roleSlots.map((slot) => (
                <div key={slot.id} className="group flex items-center justify-between p-3 bg-slate-900/35 backdrop-blur-md border border-slate-800/60 rounded-2xl hover:bg-slate-900/50 hover:border-emerald-500/30 hover:shadow-[0_0_18px_rgba(16,185,129,0.14)] transition-[background-color,border-color,box-shadow] duration-300 motion-reduce:transition-none">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <Settings2 className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:scale-110 transition-[color,transform] duration-300 motion-reduce:transform-none" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{slot.role_type}</p>
                      <p className="text-[10px] text-slate-500">
                        Capacity: {slot.capacity} · Min Trust: {slot.min_trust ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {draft.map((slot, idx) => (
              <div key={idx} className="flex items-center gap-2 p-3 bg-slate-900/35 backdrop-blur-md border border-slate-700/50 rounded-2xl">
                <select
                  value={slot.role_type}
                  aria-label={`Role type for slot ${idx + 1}`}
                  onChange={(e) => {
                    const next = [...draft];
                    next[idx] = { ...next[idx], role_type: e.target.value };
                    setDraft(next);
                  }}
                  className="flex-1 rounded-xl border border-slate-700/60 bg-slate-900/50 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/50 transition-[border-color] duration-200"
                >
                  <option value="">Select role\u2026</option>
                  {DEFAULT_ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={slot.capacity}
                  onChange={(e) => {
                    const next = [...draft];
                    next[idx] = { ...next[idx], capacity: Math.max(1, parseInt(e.target.value) || 1) };
                    setDraft(next);
                  }}
                  className="w-16 rounded-xl border border-slate-700/60 bg-slate-900/50 px-2 py-1.5 text-xs text-slate-200 text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/50 transition-[border-color] duration-200"
                  aria-label={`Capacity for slot ${idx + 1}`}
                />
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={slot.min_trust ?? 0}
                  onChange={(e) => {
                    const next = [...draft];
                    next[idx] = { ...next[idx], min_trust: Math.max(0, parseInt(e.target.value) || 0) };
                    setDraft(next);
                  }}
                  className="w-16 rounded-xl border border-slate-700/60 bg-slate-900/50 px-2 py-1.5 text-xs text-slate-200 text-center focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/50 transition-[border-color] duration-200"
                  aria-label={`Minimum trust score for slot ${idx + 1}`}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveSlot(idx)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition-[color] duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400/50 rounded-lg"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddSlot}
              disabled={draft.length >= 10}
              className="w-full py-2 text-xs text-indigo-400 border border-dashed border-indigo-500/30 rounded-xl hover:bg-indigo-500/5 hover:border-indigo-500/50 transition-[background-color,border-color] duration-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/50"
            >
              + Add Slot
            </button>

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => void handleSaveSlots()}
                disabled={isBusy || draft.length === 0 || draft.some((s) => !s.role_type)}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold hover:from-indigo-400 hover:to-violet-400 active:scale-95 motion-reduce:active:scale-100 shadow-lg shadow-indigo-500/15 transition-[box-shadow,transform] duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                {processingKey === "save_slots" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save Slots
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700/60 bg-slate-900/30 text-slate-400 text-xs font-bold hover:bg-slate-900/45 hover:border-slate-600/80 transition-[background-color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Tab: Revenue Split
  // ──────────────────────────────────────────────────────────────

  function RevenueSplitTab() {
    const [draftShares, setDraftShares] = useState<Array<{ user_id: string; wallet: string; bps: number }>>(
      () =>
        activeMembers.map((m) => ({
          user_id: "", // will be resolved from props or set by user
          wallet: getMemberWallet(m),
          bps: Math.floor(10000 / activeMembers.length),
        })),
    );
    const [splitError, setSplitError] = useState<string | null>(null);

    const totalBps = draftShares.reduce((acc, s) => acc + s.bps, 0);
    const bpsValid = totalBps === 10000;

    const hasSigned = currentUserId ? signedUserIds.includes(currentUserId) : false;
    const proposal = activeProposal;
    const isProposalDraft = proposal?.state === "draft";
    const isProposalLocked = proposal?.state === "locked";
    const myShareInProposal = proposal?.shares.find(
      (s) => s.user_id === currentUserId,
    );
    const canSignProposal = isProposalDraft && myShareInProposal && !hasSigned && canSign;

    const handleCreateProposal = async () => {
      if (!currentUserId) { setSplitError("Not authenticated."); return; }
      if (!bpsValid) { setSplitError("Total BPS must equal 10,000."); return; }
      setSplitError(null);
      const key = "create_split";
      setProcessingKey(key);
      try {
        const shares = draftShares.map((s) => ({ user_id: s.user_id, bps: s.bps }));
        const result = await createSplitProposal(projectId, currentUserId, shares);
        if (!isMounted.current) return;
        if (result.success) {
          onRefresh();
        } else {
          setSplitError(result.error ?? "Failed to create proposal.");
        }
      } catch {
        if (isMounted.current) setSplitError("Failed to create split proposal.");
      } finally {
        if (isMounted.current) setProcessingKey((cur) => (cur === key ? null : cur));
      }
    };

    const handleSignProposal = async () => {
      if (!proposal || !currentUserId || !actorWallet || !signMessage) return;
      setSplitError(null);
      const key = "sign_split";
      setProcessingKey(key);
      try {
        // Build deterministic shares hash
        const sortedShares = [...proposal.shares]
          .sort((a, b) => a.user_id.localeCompare(b.user_id))
          .map((s) => ({ bps: s.bps, user_id: s.user_id, wallet: s.wallet }));
        const sharesJsonBytes = new TextEncoder().encode(stableStringify({ shares: JSON.stringify(sortedShares) } as Record<string, string>));
        const sharesHash = await sha256Hex(sharesJsonBytes);

        // Build flat payload
        const timestamp = Date.now();
        const payload: Record<string, string | number> = {
          chain: "solana-mainnet",
          domain: "pumpmatch-split",
          projectId,
          proposalId: proposal.id,
          sharesHash,
          signerWallet: actorWallet,
          timestamp,
          v: 1,
        };

        const payloadBytes = new TextEncoder().encode(stableStringify(payload as Record<string, string | number>));
        const payloadHash = await sha256Hex(payloadBytes);
        const signatureBase58 = bs58.encode(await signMessage(payloadBytes));

        const result = await signSplitProposal(proposal.id, currentUserId, signatureBase58, payloadHash);
        if (!isMounted.current) return;
        if (result.success) {
          onRefresh();
        } else {
          setSplitError(result.error ?? "Signing failed.");
        }
      } catch (e) {
        console.error("Split sign failed:", e);
        if (isMounted.current) setSplitError("Signature rejected or network error.");
      } finally {
        if (isMounted.current) setProcessingKey((cur) => (cur === key ? null : cur));
      }
    };

    return (
      <div className="p-4">
        {splitError && (
          <div className="mb-3 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2 backdrop-blur-sm">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> {splitError}
          </div>
        )}

        {/* Existing proposal view */}
        {proposal ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                Revenue Split Proposal
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isProposalLocked
                    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                    : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                }`}
              >
                {isProposalLocked ? "Locked" : "Pending Signatures"}
              </span>
            </div>

            {/* Cap table visualization */}
            {proposal.shares.map((share) => {
              const pct = (share.bps / 100).toFixed(1);
              const signed = signedUserIds.includes(share.user_id);
              return (
                <div key={share.user_id} className="group relative overflow-hidden p-3 bg-slate-900/35 backdrop-blur-md rounded-2xl border border-slate-700/50 hover:bg-slate-900/45 transition-[background-color] duration-200">
                  <div className="absolute left-0 top-0 h-full w-[2px] bg-emerald-500/0 group-hover:bg-emerald-500/60 transition-[background-color] duration-200" />
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-300">{maskWallet(share.wallet)}</span>
                      {signed ? (
                        <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-[0_0_12px_rgba(16,185,129,0.12)]">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Signed
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-500 bg-slate-700/30 border border-slate-600/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 animate-pulse motion-reduce:animate-none" />
                          Pending
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-200 tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width,background-color] duration-500 ${signed ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-slate-600"}`}
                      style={{ width: `${share.bps / 100}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="text-[10px] text-slate-500 text-center mt-2 tabular-nums">
              {signedUserIds.length} / {proposal.shares.length} signatures collected
            </div>

            {/* Sign button */}
            {canSignProposal && (
              <button
                type="button"
                onClick={() => void handleSignProposal()}
                disabled={isBusy}
                className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold hover:from-emerald-400 hover:to-teal-400 active:scale-95 motion-reduce:active:scale-100 shadow-lg shadow-emerald-500/15 transition-[box-shadow,transform] duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                {processingKey === "sign_split" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Signing...</>
                ) : (
                  <><Lock className="w-4 h-4" /> Sign Proposal (Off-Chain)</>
                )}
              </button>
            )}

            {isProposalLocked && (
              <div className="mt-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-center backdrop-blur-sm shadow-[0_0_20px_rgba(16,185,129,0.06)]">
                <Lock className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-emerald-300">Split Locked</p>
                <p className="text-[10px] text-slate-500 mt-1">All signatures collected. Squad is ready for launch.</p>
              </div>
            )}
          </div>
        ) : isFounder ? (
          /* Split builder for founder */
          <div className="space-y-3">
            <h3 className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">
              Configure Revenue Split
            </h3>
            <p className="text-[10px] text-slate-500 mb-3">
              Allocate BPS (basis points) to each active member. Total must equal 10,000 (100%).
            </p>

            {activeMembers.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">
                Add members before creating a split proposal.
              </div>
            ) : (
              <>
                {draftShares.map((share, idx) => {
                  const member = activeMembers[idx];
                  const w = member ? getMemberWallet(member) : share.wallet;
                  return (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-900/35 backdrop-blur-md border border-slate-700/50 rounded-2xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-slate-300 truncate">{maskWallet(w)}</p>
                        <p className="text-[10px] text-slate-500">{member?.role ?? "Member"}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={10000}
                          value={share.bps}
                          aria-label={`Basis points for ${maskWallet(w)}`}
                          onChange={(e) => {
                            const next = [...draftShares];
                            next[idx] = { ...next[idx], bps: Math.max(0, parseInt(e.target.value) || 0) };
                            setDraftShares(next);
                          }}
                          className="w-20 rounded-xl border border-slate-700/60 bg-slate-900/50 px-2 py-1.5 text-xs text-slate-200 text-right focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50 transition-[border-color] duration-200"
                        />
                        <span className="text-[10px] text-slate-500">BPS</span>
                      </div>
                    </div>
                  );
                })}

                <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border backdrop-blur-sm ${bpsValid ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_12px_rgba(16,185,129,0.06)]" : "border-rose-500/30 bg-rose-500/5"}`}>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Total</span>
                  <span className={`text-sm font-bold tabular-nums ${bpsValid ? "text-emerald-400" : "text-rose-400"}`}>
                    {totalBps.toLocaleString()} / 10,000
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreateProposal()}
                  disabled={isBusy || !bpsValid || draftShares.length === 0}
                  className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold hover:from-emerald-400 hover:to-teal-400 active:scale-95 motion-reduce:active:scale-100 shadow-lg shadow-emerald-500/15 transition-[box-shadow,transform] duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {processingKey === "create_split" ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                  ) : (
                    <><Coins className="w-4 h-4" /> Create Split Proposal</>
                  )}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-10 text-slate-600 text-sm">
            No active split proposal. The squad leader will create one.
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "members", label: "Members", icon: <Users className="w-4 h-4" />, count: activeMembers.length },
    { key: "slots", label: "Role Slots", icon: <Settings2 className="w-4 h-4" />, count: roleSlots.length },
    { key: "split", label: "Revenue Split", icon: <Coins className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full bg-slate-900/40 backdrop-blur-xl border border-slate-800/70 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/5">
      {/* Wallet gating */}
      {!connected || !actorWallet ? (
        <div className="p-4 text-sm text-slate-400 bg-slate-950/30">
          Connect your wallet to access the Command Center.
        </div>
      ) : null}

      {connected && actorWallet && !canSign ? (
        <div className="p-4 text-sm text-slate-400 bg-slate-950/30">
          Your wallet does not support message signing. Actions are disabled.
        </div>
      ) : null}

      {/* Progress Bar */}
      {connected && actorWallet && (
        <div className="px-4 pt-5">
          <OpsProgressBar status={opsStatus} />
        </div>
      )}

      {/* Tab Bar */}
      <div role="tablist" aria-label="Squad management" className="flex items-center border-b border-slate-800/70 bg-slate-950/60 backdrop-blur-sm px-4 pt-2 gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 text-sm font-medium transition-[color] duration-200 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 rounded-t ${
              activeTab === tab.key ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="flex items-center gap-2">
              {tab.icon} {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-slate-800/80 text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full tabular-nums border border-slate-700/50">
                  {tab.count}
                </span>
              )}
            </span>
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full shadow-[0_-2px_10px_rgba(16,185,129,0.55)]" />
            )}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mx-4 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl backdrop-blur-sm flex items-center gap-2 text-rose-400 text-xs break-words" role="alert">
          <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" /> {errorMsg}
        </div>
      )}

      {/* Tab Content */}
      <div className="max-h-[55vh] overflow-y-auto">
        <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {activeTab === "members" && <MembersTab />}
          {activeTab === "slots" && <RoleSlotsTab />}
          {activeTab === "split" && <RevenueSplitTab />}
        </div>
      </div>
    </div>
  );
}
