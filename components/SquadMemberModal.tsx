"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Loader2, Users, AlertTriangle, ShieldCheck, UserPlus, Briefcase, Wallet } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { addSquadMemberAction, joinSquadAction } from "@/app/actions/arena";

type RoleType = "developer" | "marketing" | "community" | "designer" | "advisor";

interface SquadMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  isFounder: boolean;
  walletAddress: string;
  onSuccess: () => void;
}

const ROLES = [
  { value: "developer", label: "Developer", desc: "Smart Contracts & Tech" },
  { value: "marketing", label: "Marketing", desc: "Growth & Shilling" },
  { value: "community", label: "Community Lead", desc: "Discord & Telegram" },
  { value: "designer", label: "Designer", desc: "UI/UX & Art" },
  { value: "advisor", label: "Advisor", desc: "Strategy & Networking" },
];

function maskWallet(address: string) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * CLIENT-SIDE CANONICALIZER (V1.5 Güvenlik Katmanı)
 * Backend ile imzanın birebir eşleşmesi için objeyi sıralar ve byte'a çevirir.
 */
function createCanonicalMessage(payload: Record<string, any>): Uint8Array {
  const sortedKeys = Object.keys(payload).sort((a, b) => a.localeCompare(b));
  const canonicalObject: Record<string, any> = {};
  for (const key of sortedKeys) {
    canonicalObject[key] = payload[key];
  }
  return new TextEncoder().encode(JSON.stringify(canonicalObject));
}

export function SquadMemberModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  isFounder,
  walletAddress,
  onSuccess,
}: SquadMemberModalProps) {
  const [targetWallet, setTargetWallet] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleType>("marketing");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { signMessage } = useWallet();

  useEffect(() => {
    if (isOpen) {
      setTargetWallet("");
      setSelectedRole("marketing");
      setSubmitError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => { 
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => { if (e.target === overlayRef.current) onClose(); },
    [onClose],
  );

  const handleSubmit = async () => {
    setSubmitError(null);
    setSuccessMsg(null);

    let normalizedWallet: string;
    let normalizedTarget: string;

    try {
      normalizedWallet = new PublicKey(walletAddress.trim()).toBase58();
      normalizedTarget = isFounder ? new PublicKey(targetWallet.trim()).toBase58() : normalizedWallet;
    } catch {
      setSubmitError("Invalid Solana wallet address detected. Please verify the public key.");
      return;
    }

    if (!signMessage) {
      setSubmitError("Your wallet does not support message signing.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const nonce = crypto.randomUUID();
      const timestamp = Date.now();
      
      // 🔥 DÜZELTİLDİ: Backend Enum'larına ("invite" ve "apply") göre eşleşen aksiyon tipleri
      const actionType = isFounder ? "invite" : "apply";
      
      // 🔥 DÜZELTİLDİ: Düz metin yerine Canonical JSON Objensi oluşturuyoruz
      const payloadObj = {
        action: actionType,
        chain: "solana-mainnet",
        domain: "pumpmatch-governance",
        env: process.env.NODE_ENV === "production" ? "production" : "development",
        nonce: nonce,
        project: projectId,
        role: selectedRole,
        target: normalizedTarget,
        timestamp: timestamp,
        v: 1
      };

      const messageBytes = createCanonicalMessage(payloadObj);

      let signatureBase58: string;
      try {
        signatureBase58 = bs58.encode(await signMessage(messageBytes));
      } catch (signError: any) {
        setSubmitError("Signature request was rejected.");
        setIsSubmitting(false);
        return;
      }

      let result;
      if (isFounder) {
        result = await addSquadMemberAction({
          projectId,
          targetWallet: normalizedTarget,
          founderWallet: normalizedWallet,
          role: selectedRole,
          nonce,
          timestamp,
          signature: signatureBase58
        });
      } else {
        result = await joinSquadAction({
          projectId,
          walletAddress: normalizedWallet,
          role: selectedRole,
          nonce,
          timestamp,
          signature: signatureBase58
        });
      }

      if (result.success) {
        setSuccessMsg(isFounder ? "Invitation sent successfully!" : "Application submitted successfully!");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setSubmitError(result.message);
      }
    } catch (error) {
      console.error("[Squad Modal] Unexpected error:", error);
      setSubmitError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={overlayRef} onClick={handleOverlayClick} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-lg p-6 shadow-2xl shadow-blue-500/10 animate-in fade-in zoom-in-95 duration-200">
        
        <button type="button" onClick={onClose} className="absolute top-4 right-4 rounded-full p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors">
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
            {isFounder ? <UserPlus className="h-5 w-5 text-blue-400" /> : <Users className="h-5 w-5 text-blue-400" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              {isFounder ? "Invite Squad Member" : "Apply to Squad"}
            </h2>
            <p className="text-xs text-slate-500 truncate max-w-[250px]">
              {isFounder ? `Send an invite to join ${projectName}` : `Request to join ${projectName}`}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {isFounder ? (
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                Target Wallet Address
              </label>
              <input
                type="text"
                placeholder="e.g. 8xAd... (Solana Public Key)"
                value={targetWallet}
                onChange={(e) => setTargetWallet(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors font-mono text-xs"
              />
            </div>
          ) : (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">Applying as:</span>
              </div>
              <span className="font-mono text-xs text-slate-200 font-medium bg-slate-900/50 px-2 py-1 rounded">
                {maskWallet(walletAddress)}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2">
              <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Select Proposed Role</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setSelectedRole(r.value as RoleType)}
                  className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                    selectedRole === r.value
                      ? "border-blue-500 bg-blue-500/10 shadow-[0_0_10px_-2px_rgba(59,130,246,0.2)]"
                      : "border-slate-700/60 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-600"
                  }`}
                >
                  <span className={`text-xs font-bold ${selectedRole === r.value ? "text-blue-400" : "text-slate-300"}`}>{r.label}</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {submitError && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300 leading-snug">{submitError}</p>
          </div>
        )}
        {successMsg && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-300 leading-snug">{successMsg}</p>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting || (isFounder && !targetWallet.trim()) || !!successMsg} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-50 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)]">
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing...</> : isFounder ? "Sign & Send Invite" : "Sign & Send Request"}
          </button>
        </div>

      </div>
    </div>
  );
}