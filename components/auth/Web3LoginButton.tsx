"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowRight } from "lucide-react";

type Phase = "idle" | "signing" | "redirecting";

export function Web3LoginButton({ size = "default" }: { size?: "default" | "lg" }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const login = useCallback(async () => {
    if (phase !== "idle") return; // Prevent double-clicks at any phase
    setPhase("signing");
    setError(null);

    try {
      const wallet =
        (window as any).phantom?.solana ?? (window as any).solana;

      if (!wallet?.isPhantom) {
        throw new Error(
          "Phantom wallet not found. Please install the Phantom extension."
        );
      }

      const { data, error: authError } = await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement: "Sign in to PumpMatch",
        wallet,
      });

      if (authError) throw authError;

      if (data?.session?.access_token) {
        await supabase.realtime.setAuth(data.session.access_token);

        // Switch to "Redirecting…" phase — prevents re-clicks and shows feedback.
        // We intentionally do NOT reset phase here; the component will unmount
        // on successful navigation.
        setPhase("redirecting");

        // router.refresh() forces Next.js to re-fetch RSC data so the new
        // Supabase session is available server-side before we navigate.
        router.refresh();
        router.push("/command-center");
      }
    } catch (err: any) {
      setError(err?.message ?? "An unknown error occurred.");
      setPhase("idle"); // Only reset on error so users can retry
    }
  }, [phase, router]);

  const isLg = size === "lg";

  const labels: Record<Phase, string> = {
    idle:        "Connect Wallet",
    signing:     "Sign in Phantom…",
    redirecting: "Redirecting…",
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={() => void login()}
        disabled={phase !== "idle"}
        className={`
          group inline-flex items-center justify-center gap-2 font-bold
          rounded-xl bg-emerald-500 text-slate-900
          hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed
          transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30
          ${isLg ? "px-8 py-4 text-base" : "px-5 py-2.5 text-sm"}
        `}
      >
        {labels[phase]}
        {phase === "idle" && (
          <ArrowRight className={`${isLg ? "h-5 w-5" : "h-4 w-4"} group-hover:translate-x-0.5 transition-transform`} />
        )}
        {phase !== "idle" && (
          <span className="h-4 w-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
        )}
      </button>
      {error && (
        <p className="text-sm text-red-400 max-w-xs leading-snug">{error}</p>
      )}
    </div>
  );
}
