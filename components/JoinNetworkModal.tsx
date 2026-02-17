"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import { joinNetwork } from "@/app/actions/analyzeWallet";
import type { WalletAnalysis } from "@/types";

function fireNetworkConfetti() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#34d399", "#10b981", "#fbbf24", "#a78bfa", "#22d3ee"],
    ticks: 120,
    gravity: 0.9,
    scalar: 1.1,
    drift: 0,
  });
}

// ──────────────────────────────────────────────────────────────
// Opt-In Network: Join / Update Intent Modal
// High-conversion, glassmorphism, accessible, animated.
// ──────────────────────────────────────────────────────────────

const INTENT_PRESETS = [
  { label: "Looking for Dev", emoji: "\u{1F6E0}" },
  { label: "Looking for Whale", emoji: "\u{1F40B}" },
  { label: "Meme Creator", emoji: "\u{1F3A8}" },
  { label: "AI Builder", emoji: "\u{1F916}" },
  { label: "Just Exploring", emoji: "\u{1F680}" },
] as const;

const CUSTOM_SENTINEL = "__CUSTOM__";

interface JoinNetworkModalProps {
  address: string;
  walletAnalysis: WalletAnalysis;
  isOpen: boolean;
  onClose: () => void;
  currentIntent?: string;
  isEditing?: boolean;
  onSuccess: (intent: string) => void;
}

export function JoinNetworkModal({
  address,
  walletAnalysis,
  isOpen,
  onClose,
  currentIntent,
  isEditing = false,
  onSuccess,
}: JoinNetworkModalProps) {
  // Determine initial selection from currentIntent
  const getInitialSelection = useCallback((): string => {
    if (!currentIntent) return "";
    const matchesPreset = INTENT_PRESETS.some((p) => p.label === currentIntent);
    return matchesPreset ? currentIntent : CUSTOM_SENTINEL;
  }, [currentIntent]);

  const [selected, setSelected] = useState<string>(getInitialSelection);
  const [customText, setCustomText] = useState<string>(
    currentIntent && !INTENT_PRESETS.some((p) => p.label === currentIntent)
      ? currentIntent
      : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Sync selection when modal opens with different currentIntent
  useEffect(() => {
    if (isOpen) {
      setSelected(getInitialSelection());
      setCustomText(
        currentIntent && !INTENT_PRESETS.some((p) => p.label === currentIntent)
          ? currentIntent
          : "",
      );
      setSubmitError(null);
    }
  }, [isOpen, currentIntent, getInitialSelection]);

  // Disable body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Outside-click to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  // Resolved intent string
  const resolvedIntent =
    selected === CUSTOM_SENTINEL ? customText.trim() : selected;

  const canSubmit =
    resolvedIntent.length > 0 &&
    resolvedIntent.length <= 40 &&
    !isSubmitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Build a WalletAnalysis copy with the selected intent baked in
      const analysisWithIntent: WalletAnalysis = {
        ...walletAnalysis,
        intent: resolvedIntent as WalletAnalysis["intent"],
      };

      const result = await joinNetwork(
        address,
        walletAnalysis.scoreLabel || "Agent",
        analysisWithIntent,
      );

      if (result.success) {
        fireNetworkConfetti();
        onSuccess(resolvedIntent);
        onClose();
      } else {
        setSubmitError(result.message);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[JoinNetworkModal] joinNetwork failed:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? "Update network intent" : "Join network"}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-emerald-500/30 bg-zinc-900/90 backdrop-blur-xl shadow-[0_0_80px_rgba(16,185,129,0.15)] animate-in zoom-in-95 fade-in duration-200">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 md:p-8">
          {/* Header */}
          <h2 className="text-xl font-semibold text-slate-100 pr-8">
            {isEditing
              ? "Update Your Network Intent"
              : "Join the Pump Match Network"}
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Choose your intent to become visible to other elite agents.
          </p>

          {/* Intent Chips */}
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            {INTENT_PRESETS.map((preset) => {
              const isActive = selected === preset.label;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setSelected(preset.label);
                    setSubmitError(null);
                  }}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "border-emerald-400 text-emerald-400 bg-emerald-500/10 shadow-sm shadow-emerald-500/10"
                      : "border-zinc-700 text-slate-300 hover:border-emerald-500/40 hover:text-slate-100"
                  }`}
                >
                  <span className="text-base leading-none">{preset.emoji}</span>
                  <span className="truncate">{preset.label}</span>
                </button>
              );
            })}

            {/* Custom chip */}
            <button
              type="button"
              onClick={() => {
                setSelected(CUSTOM_SENTINEL);
                setSubmitError(null);
              }}
              className={`col-span-2 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                selected === CUSTOM_SENTINEL
                  ? "border-emerald-400 text-emerald-400 bg-emerald-500/10 shadow-sm shadow-emerald-500/10"
                  : "border-zinc-700 text-slate-300 hover:border-emerald-500/40 hover:text-slate-100"
              }`}
            >
              <span className="text-base leading-none">{"\u270D\uFE0F"}</span>
              <span>Custom...</span>
            </button>
          </div>

          {/* Custom text input */}
          {selected === CUSTOM_SENTINEL && (
            <div className="mt-3">
              <input
                type="text"
                value={customText}
                onChange={(e) => {
                  setCustomText(e.target.value);
                  setSubmitError(null);
                }}
                maxLength={40}
                placeholder="Describe what you're looking for..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                autoFocus
              />
              <p className="mt-1 text-right text-[11px] text-slate-600">
                {customText.length}/40
              </p>
            </div>
          )}

          {/* Error */}
          {submitError && (
            <p className="mt-3 text-sm text-rose-400">{submitError}</p>
          )}

          {/* Footer buttons */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:border-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canSubmit}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-black hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-lg shadow-emerald-500/20"
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {isSubmitting
                ? "Joining..."
                : isEditing
                  ? "Update Intent"
                  : "Join Network"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
