"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Loader2, Rocket, AlertTriangle, ShieldCheck } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { claimProjectAction } from "@/app/actions/arena";

interface ClaimProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  onSuccess: () => void;
}

export function ClaimProjectModal({
  isOpen,
  onClose,
  walletAddress,
  onSuccess,
}: ClaimProjectModalProps) {
  const [projectName, setProjectName] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Cüzdanın imza atabilmesi için hook'u çağırıyoruz
  const { signMessage } = useWallet();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setProjectName("");
      setContractAddress("");
      setSubmitError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Outside click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  const handleSubmit = async () => {
    setSubmitError(null);
    setSuccessMsg(null);

    const normalizedName = projectName.trim();
    const normalizedMint = contractAddress.trim();
    const normalizedWallet = walletAddress.trim().toLowerCase();

    if (!normalizedName) {
      setSubmitError("Project name is required.");
      return;
    }
    if (!normalizedMint) {
      setSubmitError("Contract address (CA) is required.");
      return;
    }
    if (!signMessage) {
      setSubmitError("Your wallet does not support message signing. Please use a supported wallet like Phantom or Solflare.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 1. PAS-v1 Güvenlik Parametrelerini Üret (Nonce & Timestamp)
      const nonce = crypto.randomUUID();
      const timestamp = Date.now();

      // 2. Deterministik Mesajı İnşa Et (Backend'deki ile harfi harfine aynı olmalı)
      const expectedMessage = `Protocol: PumpMatch v1\nAction: claim_project\nWallet: ${normalizedWallet}\nTarget: ${normalizedMint}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
      const messageBytes = new TextEncoder().encode(expectedMessage);

      // 3. Kullanıcıya İmzalat
      let signatureBase58: string;
      try {
        const signatureBytes = await signMessage(messageBytes);
        signatureBase58 = bs58.encode(signatureBytes);
      } catch {
        setSubmitError("Signature request was rejected or failed. Proof of Authority is required to claim a project.");
        setIsSubmitting(false);
        return;
      }

      // 4. İmzayı ve Payload'u Backend'e Fırlat
      const result = await claimProjectAction({
        name: normalizedName,
        mint: normalizedMint,
        walletAddress: walletAddress, // Orijinal halini yolluyoruz, backend kendi normalize ediyor
        nonce: nonce,
        timestamp: timestamp,
        signature: signatureBase58
      });

      if (result.success) {
        setSuccessMsg(result.message);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setSubmitError(result.message);
      }
    } catch (error) {
      console.error("[Claim Modal] Unexpected error:", error);
      setSubmitError("An unexpected error occurred while processing your cryptographic signature.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-lg p-6 shadow-2xl shadow-emerald-500/10 animate-in fade-in zoom-in-95 duration-200">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-purple-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Rocket className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              Claim Project <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </h2>
            <p className="text-xs text-slate-500">
              Zero-Trust Founder Verification
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="project-name"
              className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              placeholder="e.g. PumpDog"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              maxLength={60}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="contract-address"
              className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Contract Address (Mint)
            </label>
            <input
              id="contract-address"
              type="text"
              placeholder="e.g. So11111111111111111111111111111111111111112"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 font-mono text-xs focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
            />
          </div>
        </div>

        {/* Error */}
        {submitError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300 leading-snug">{submitError}</p>
          </div>
        )}

        {/* Success */}
        {successMsg && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
            <Rocket className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-300 leading-snug">{successMsg}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !projectName.trim() ||
              !contractAddress.trim() ||
              !!successMsg
            }
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing...
              </>
            ) : (
              "Sign & Claim"
            )}
          </button>
        </div>

        <p className="mt-4 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3 w-3" />
          Requires cryptographic signature to verify Authority
        </p>
      </div>
    </div>
  );
}