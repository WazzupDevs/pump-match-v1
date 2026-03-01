"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";

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

  const tweetUrl = useMemo(() => {
    const text = `I just checked my Solana On-Chain CV on @PumpMatch!\n\nMy Trust Score is ${trustScore}/100. 🧬\n\nCheck my Pump.fun DNA here:`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`;
  }, [profileUrl, trustScore]);

  return (
    <div className="flex flex-col sm:flex-row gap-2 mt-4 md:mt-0">
      <a
        href={tweetUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-900 transition-all hover:bg-white hover:scale-105 shadow-lg shadow-white/10"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 3.827H5.078z"></path>
        </svg>
        Share on X
      </a>

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(profileUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-all hover:border-slate-500 hover:bg-slate-700/50"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
