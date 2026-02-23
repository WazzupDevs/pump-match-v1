"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Loader2, Twitter, Send } from "lucide-react";
import confetti from "canvas-confetti";
import { useWallet } from "@solana/wallet-adapter-react";
import { joinNetwork, updateProfileAction } from "@/app/actions/analyzeWallet";
import type { SocialLinks, WalletAnalysis } from "@/types";

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
  currentUsername?: string;
  currentTags?: string[];
  currentSocialLinks?: SocialLinks;
  isEditing?: boolean;
  onSuccess: (intent: string) => void;
}

export function JoinNetworkModal({
  address,
  walletAnalysis,
  isOpen,
  onClose,
  currentIntent,
  currentUsername,
  currentTags,
  currentSocialLinks,
  isEditing = false,
  onSuccess,
}: JoinNetworkModalProps) {
  const { signMessage } = useWallet();
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
  const [username, setUsername] = useState(currentUsername ?? "");
  const [tagsInput, setTagsInput] = useState((currentTags ?? []).join(", "));
  const [twitterHandle, setTwitterHandle] = useState(currentSocialLinks?.twitter ?? "");
  const [telegramHandle, setTelegramHandle] = useState(currentSocialLinks?.telegram ?? "");
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
      setUsername(currentUsername ?? "");
      setTagsInput((currentTags ?? []).join(", "));
      setTwitterHandle(currentSocialLinks?.twitter ?? "");
      setTelegramHandle(currentSocialLinks?.telegram ?? "");
      setSubmitError(null);
    }
  }, [isOpen, currentIntent, currentUsername, currentTags, currentSocialLinks, getInitialSelection]);

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
      // SECURITY (VULN-01): Sign a message to prove wallet ownership.
      let signedMessage: { message: string; signature: string } | undefined;

      if (signMessage) {
        const timestamp = Date.now();
        const action = isEditing ? "Update Profile" : "Join Pump Match Network";
        const messageText = `${action}\nAddress: ${address}\nTimestamp: ${timestamp}`;
        const messageBytes = new TextEncoder().encode(messageText);
        const signatureBytes = await signMessage(messageBytes);
        const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));
        signedMessage = { message: messageText, signature: signatureBase64 };
      } else {
        console.warn("[JoinNetworkModal] signMessage not available on this wallet.");
      }

      const socialLinks: SocialLinks = {
        ...(twitterHandle.trim() ? { twitter: twitterHandle.trim().replace(/^@/, "") } : {}),
        ...(telegramHandle.trim() ? { telegram: telegramHandle.trim().replace(/^@/, "") } : {}),
      };

      if (isEditing && signedMessage) {
        // Edit mode: lightweight profile update (no WalletAnalysis re-fetch needed)
        const parsedTags = tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10);

        const result = await updateProfileAction(
          address,
          {
            username: username.trim() || undefined,
            tags: parsedTags.length > 0 ? parsedTags : undefined,
            socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
          },
          signedMessage,
        );

        if (result.success) {
          onSuccess(resolvedIntent);
          onClose();
        } else {
          setSubmitError(result.message);
        }
        return;
      }

      // First join: full joinNetwork with WalletAnalysis
      const analysisWithIntent: WalletAnalysis = {
        ...walletAnalysis,
        intent: resolvedIntent as WalletAnalysis["intent"],
      };

      const result = await joinNetwork(
        address,
        username.trim() || walletAnalysis.scoreLabel || "Agent",
        analysisWithIntent,
        signedMessage,
        Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
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
      console.error("[JoinNetworkModal] failed:", err);
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

          {/* Username field */}
          <div className="mt-5">
            <label className="block text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={32}
              placeholder="Your on-chain alias (max 32 chars)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
            />
          </div>

          {/* Intent Chips */}
          <div className="mt-5 grid grid-cols-2 gap-2.5">
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

          {/* Tags (optional) */}
          <div className="mt-4">
            <label className="block text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-1.5">
              Interests <span className="normal-case text-slate-600">(optional — comma separated)</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              maxLength={200}
              placeholder="e.g. NFT, DeFi, AI, Gaming"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
            />
            {/* Live tag preview */}
            {tagsInput.trim() && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tagsInput.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md border border-slate-700/50 bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-300"
                  >
                    {tag.slice(0, 20)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Social Handles (optional) */}
          <div className="mt-4 space-y-2.5">
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">
              Contact Handles <span className="normal-case text-slate-600">(optional)</span>
            </p>
            <div className="relative">
              <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sky-400" />
              <input
                type="text"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                maxLength={32}
                placeholder="@username"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 transition-colors"
              />
            </div>
            <div className="relative">
              <Send className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400" />
              <input
                type="text"
                value={telegramHandle}
                onChange={(e) => setTelegramHandle(e.target.value)}
                maxLength={32}
                placeholder="@username"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors"
              />
            </div>
          </div>

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
