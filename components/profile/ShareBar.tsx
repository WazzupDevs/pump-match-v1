"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useSquadAuth } from "@/components/providers/SquadProvider";

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function normalizeAddress(input: string | null | undefined): string {
  let normalized = (input ?? "").trim();
  if (normalized.startsWith("web3:solana:")) {
    normalized = normalized.slice("web3:solana:".length);
  }
  return normalized;
}

export function ShareBar({
  address,
  trustScore,
  profileUrl,
}: {
  address: string;
  trustScore: number;
  profileUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const { walletAddress } = useSquadAuth();

  const normalizedViewed = normalizeAddress(address);
  const normalizedConnected = normalizeAddress(walletAddress);

  const isOwner =
    BASE58_REGEX.test(normalizedViewed) &&
    BASE58_REGEX.test(normalizedConnected) &&
    normalizedViewed === normalizedConnected;

  const tweetUrl = useMemo(() => {
    const text = `I checked my public behavioral analysis on @PumpMatch.\n\nVisible score: ${trustScore}/100\n\nView the profile here:`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(
      profileUrl
    )}`;
  }, [profileUrl, trustScore]);

  return (
    <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:flex-row">
      {isOwner ? (
        <a
          href={tweetUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-lg shadow-white/10 transition-colors hover:bg-white"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 3.827H5.078z"></path>
          </svg>
          Share on X
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="cursor-not-allowed inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-900 opacity-60 shadow-lg shadow-white/10"
          title="Connect this wallet to share"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 3.827H5.078z"></path>
          </svg>
          Share on X
        </button>
      )}

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(profileUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-700/50"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}