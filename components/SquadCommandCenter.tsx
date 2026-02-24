"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { ShieldCheck, XCircle, CheckCircle2, UserMinus, Clock, Users, ShieldAlert, Loader2, LogOut } from "lucide-react";
import { executeSquadTransitionAction } from "@/app/actions/arena";

type SquadStatus = 'pending_invite' | 'pending_application' | 'active' | 'rejected' | 'revoked' | 'kicked' | 'left';
type ActionType = 'approve_app' | 'reject_app' | 'accept_invite' | 'reject_invite' | 'revoke_invite' | 'kick' | 'leave';

interface SquadMember {
  id: string;
  wallet_address: string;
  role: string;
  status: SquadStatus;
  joined_at?: string;
}

interface SquadCommandCenterProps {
  projectId: string;
  isFounder: boolean;
  currentUserWallet: string;
  members: SquadMember[];
  onRefresh: () => void;
}

function maskWallet(address: string) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * CLIENT-SIDE CANONICALIZER
 */
type CanonicalValue = string | number | boolean | null;
function createCanonicalMessage(payload: Record<string, CanonicalValue>): Uint8Array {
  const sortedKeys = Object.keys(payload).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalObject: Record<string, CanonicalValue> = {};
  for (const key of sortedKeys) {
    canonicalObject[key] = payload[key];
  }
  return new TextEncoder().encode(JSON.stringify(canonicalObject));
}

// 🔥 DİKKAT: Doğru Export Şekli (Süslü parantezli import için)
export function SquadCommandCenter({
  projectId,
  isFounder,
  currentUserWallet,
  members,
  onRefresh
}: SquadCommandCenterProps) {
  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { signMessage } = useWallet();

  const handleTransition = async (targetWallet: string, actionType: ActionType, role: string, memberId: string) => {
    if (!signMessage) {
      setErrorMsg("Wallet not connected or doesn't support signing.");
      return;
    }

    setProcessingId(memberId);
    setErrorMsg(null);

    try {
      const nonce = crypto.randomUUID();
      const timestamp = Date.now();
      
      const payloadObj = {
        action: actionType,
        chain: "solana-mainnet",
        domain: "pumpmatch-governance",
        env: process.env.NODE_ENV === "production" ? "production" : "development",
        nonce: nonce,
        project: projectId,
        role: role,
        target: targetWallet,
        timestamp: timestamp,
        v: 1
      };

      const messageBytes = createCanonicalMessage(payloadObj);
      const signatureBase58 = bs58.encode(await signMessage(messageBytes));

      const result = await executeSquadTransitionAction({
        projectId,
        actorWallet: currentUserWallet,
        targetWallet,
        actionType,
        role,
        nonce,
        timestamp,
        signature: signatureBase58
      });

      if (result.success) {
        onRefresh(); 
      } else {
        setErrorMsg(result.message || "Protocol transition failed.");
      }
    } catch (error) {
      console.error("Transition failed:", error);
      setErrorMsg("Transaction rejected by user or network error.");
    } finally {
      setProcessingId(null);
    }
  };

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingRequests = members.filter(m => 
    m.status === 'pending_application' || m.status === 'pending_invite'
  );

  return (
    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      
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
              <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                {pendingRequests.length}
              </span>
            )}
          </span>
          {activeTab === "pending" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 rounded-t-full shadow-[0_-2px_8px_rgba(245,158,11,0.5)]" />
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="mx-4 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-xs break-words">
          <ShieldAlert className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      <div className="p-4 max-h-[50vh] overflow-y-auto">
        {/* ================= ACTIVE SQUAD ================= */}
        {activeTab === "active" && (
          <div className="space-y-3">
            {activeMembers.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No active members yet.</div>
            ) : (
              activeMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-mono text-slate-200">{maskWallet(member.wallet_address)}</p>
                      <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">{member.role}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isFounder && member.wallet_address.toLowerCase() !== currentUserWallet.toLowerCase() && (
                      <button
                        onClick={() => handleTransition(member.wallet_address, 'kick', member.role, member.id)}
                        disabled={processingId !== null}
                        className={`p-2 rounded-lg transition-colors group relative ${processingId === member.id ? "text-rose-400" : "text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"}`}
                        title="Kick Member"
                      >
                        {processingId === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                      </button>
                    )}
                    {!isFounder && member.wallet_address.toLowerCase() === currentUserWallet.toLowerCase() && (
                      <button
                        onClick={() => handleTransition(member.wallet_address, 'leave', member.role, member.id)}
                        disabled={processingId !== null}
                        className={`px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 ${processingId === member.id ? "text-slate-400 border-slate-600 cursor-not-allowed" : "text-rose-400 border-rose-500/30 hover:bg-rose-500/10"}`}
                      >
                        {processingId === member.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                        Leave Squad
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= PENDING REQUESTS ================= */}
        {activeTab === "pending" && (
          <div className="space-y-3">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No pending requests.</div>
            ) : (
              pendingRequests.map(member => {
                const isApplication = member.status === 'pending_application';
                const isInvite = member.status === 'pending_invite';
                const isMe = member.wallet_address.toLowerCase() === currentUserWallet.toLowerCase();

                const canApproveApp = isFounder && isApplication;
                const canRevokeInvite = isFounder && isInvite;
                const canAcceptInvite = !isFounder && isMe && isInvite;

                if (!isFounder && !isMe) return null;

                return (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-mono text-slate-200">
                          {isMe ? "You" : maskWallet(member.wallet_address)}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{member.role}</span>
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
                          <button onClick={() => handleTransition(member.wallet_address, 'reject_app', member.role, member.id)} disabled={processingId !== null} className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                            {processingId === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleTransition(member.wallet_address, 'approve_app', member.role, member.id)} disabled={processingId !== null} className={`px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 ${processingId === member.id ? "text-slate-400 border-slate-600 cursor-not-allowed" : "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"}`}>
                            {processingId === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve
                          </button>
                        </>
                      )}

                      {canRevokeInvite && (
                        <button onClick={() => handleTransition(member.wallet_address, 'revoke_invite', member.role, member.id)} disabled={processingId !== null} className={`px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 ${processingId === member.id ? "text-slate-400 border-slate-600 cursor-not-allowed" : "text-rose-400 border-rose-500/30 hover:bg-rose-500/10"}`}>
                          {processingId === member.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Revoke Invite
                        </button>
                      )}

                      {canAcceptInvite && (
                        <>
                          <button onClick={() => handleTransition(member.wallet_address, 'reject_invite', member.role, member.id)} disabled={processingId !== null} className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                            {processingId === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleTransition(member.wallet_address, 'accept_invite', member.role, member.id)} disabled={processingId !== null} className={`px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 ${processingId === member.id ? "text-slate-400 border-slate-600 cursor-not-allowed" : "text-blue-400 border-blue-500/30 hover:bg-blue-500/10"}`}>
                            {processingId === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Accept Invite
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