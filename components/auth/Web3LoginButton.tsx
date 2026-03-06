"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ArrowRight, LogOut, Wallet } from "lucide-react";
import { useSquadAuth } from "@/components/providers/SquadProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

type Phase = "idle" | "signing" | "redirecting" | "disconnecting";

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const withTimeout = async <T,>(p: Promise<T>, ms: number): Promise<T | null> => {
  try {
    return await Promise.race([p, sleep(ms).then(() => null as any)]);
  } catch {
    return null;
  }
};

export function Web3LoginButton({ size = "default" }: { size?: "default" | "lg" }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const mountedRef = useRef(true);

  const { userId, clearAuthState } = useSquadAuth();
  const { wallet, connect, disconnect, connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  const isGhost = Boolean(userId && (!connected || !publicKey));
  const isLg = size === "lg";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const login = useCallback(async () => {
    if (phase !== "idle") return;
    setPhase("signing");
    setError(null);

    try {
      const windowWallet = (window as any).phantom?.solana ?? (window as any).solana;

      if (!windowWallet?.isPhantom) {
        throw new Error("Phantom wallet not found. Please install the Phantom extension.");
      }

      const { data, error: authError } = await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement: "Sign in to PumpMatch",
        wallet: windowWallet,
      });

      if (authError) throw authError;

      if (data?.session?.access_token) {
        await supabase.realtime.setAuth(data.session.access_token);
        if (!mountedRef.current) return;
        setPhase("idle");
        router.refresh();
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err?.message ?? "An unknown error occurred.");
      setPhase("idle");
    }
  }, [phase, router]);

  const wakeUpWallet = async () => {
    setError(null);
    if (wallet) {
      try {
        await connect();
      } catch {
        setError("Unlock your wallet and try again.");
      }
    } else {
      // Sniper Modal Trick: Let the user choose gracefully
      setVisible(true); 
    }
  };

  const logout = useCallback(async () => {
    if (phase === "disconnecting") return;
    setPhase("disconnecting");

    // Optimistic UI: immediately clear local auth UI
    clearAuthState();

    // Failsafe: never allow permanent "disconnecting" lock
    const failsafe = setTimeout(() => {
      if (mountedRef.current) setPhase("idle");
    }, 5000);

    try {
      // Attempt adapter disconnect, but never block UI on it
      if (disconnect) void withTimeout(disconnect(), 3000);

      // Clear realtime auth best-effort
      try { await withTimeout(supabase.realtime.setAuth(""), 1000); } catch {}

      // Supabase signOut with timeout (resolve-based, not reject-based)
      await withTimeout(supabase.auth.signOut(), 2500);
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      clearTimeout(failsafe);
      if (mountedRef.current) {
        setPhase("idle");
        router.refresh();
        if (window.location.pathname !== "/") router.push("/");
      }
    }
  }, [phase, clearAuthState, disconnect, router]);

  // ── GHOST STATE RENDER ──
  if (isGhost) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          onClick={wakeUpWallet}
          className={`
            group inline-flex items-center justify-center gap-2 font-bold
            rounded-xl bg-amber-500 text-slate-900
            hover:bg-amber-400 transition-[background-color,box-shadow] duration-200 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
            ${isLg ? "px-8 py-4 text-base" : "px-5 py-2.5 text-sm"}
          `}
        >
          Wake Up Wallet
          <Wallet className={`${isLg ? "h-5 w-5" : "h-4 w-4"} group-hover:-translate-y-0.5 transition-transform`} />
        </button>
        {error && (
          <p className="text-sm text-amber-500 max-w-xs leading-snug">{error}</p>
        )}
      </div>
    );
  }

  // ── NORMAL LOGGED IN RENDER (DISCONNECT) ──
  if (userId) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          onClick={() => void logout()}
          disabled={phase === "disconnecting"}
          className={`
            group inline-flex items-center justify-center gap-2 font-bold
            rounded-xl bg-red-500/10 text-red-400 border border-red-500/20
            hover:bg-red-500/20 disabled:opacity-60 disabled:cursor-not-allowed
            transition-[background-color,border-color] duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
            ${isLg ? "px-8 py-4 text-base" : "px-5 py-2.5 text-sm"}
          `}
        >
          {phase === "disconnecting" ? "Disconnecting\u2026" : "Disconnect Wallet"}
          {phase !== "disconnecting" && <LogOut className={`${isLg ? "h-5 w-5" : "h-4 w-4"} group-hover:-translate-x-0.5 transition-transform`} />}
        </button>
      </div>
    );
  }

  // ── LOGGED OUT RENDER (CONNECT) ──
  const labels: Record<Phase, string> = {
    idle: "Connect Wallet",
    signing: "Sign in Phantom…",
    redirecting: "Redirecting…",
    disconnecting: "Disconnecting\u2026",
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
          transition-[background-color,box-shadow] duration-200 hover:shadow-lg hover:shadow-emerald-500/30
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
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