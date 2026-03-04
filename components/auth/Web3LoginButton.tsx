"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ArrowRight, LogOut } from "lucide-react";
import { useSquadAuth } from "@/components/providers/SquadProvider";

type Phase = "idle" | "signing" | "redirecting" | "disconnecting";

export function Web3LoginButton({ size = "default" }: { size?: "default" | "lg" }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const mountedRef = useRef(true);

  const { userId, clearAuthState } = useSquadAuth();

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
      const wallet = (window as any).phantom?.solana ?? (window as any).solana;

      if (!wallet?.isPhantom) {
        throw new Error("Phantom wallet not found. Please install the Phantom extension.");
      }

      const { data, error: authError } = await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement: "Sign in to PumpMatch",
        wallet,
      });

      if (authError) throw authError;

      if (data?.session?.access_token) {
        await supabase.realtime.setAuth(data.session.access_token);
        if (!mountedRef.current) return;
        setPhase("idle");
        router.refresh();
        // No auto-redirect: user stays on current page; they navigate via "Enter Command Center" link.
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err?.message ?? "An unknown error occurred.");
      setPhase("idle");
    }
  }, [phase, router]);

  const logout = useCallback(async () => {
    if (phase === "disconnecting") return;
    setPhase("disconnecting");
    // Optimistic clear: UI updates immediately so "Connect Wallet" shows even if signOut event is delayed
    clearAuthState();
    try {
      await supabase.realtime.setAuth("");
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      if (!mountedRef.current) return;
      setPhase("idle");
      router.refresh();
      const pathname = window.location.pathname;
      if (pathname !== "/") router.push("/");
    }
  }, [router, phase, clearAuthState]);

  const isLg = size === "lg";

  // EĞER KULLANICI GİRİŞ YAPMIŞSA KIRMIZI "DISCONNECT" BUTONUNU GÖSTER
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
            transition-all duration-200
            ${isLg ? "px-8 py-4 text-base" : "px-5 py-2.5 text-sm"}
          `}
        >
          {phase === "disconnecting" ? "Disconnecting..." : "Disconnect Wallet"}
          {phase !== "disconnecting" && <LogOut className={`${isLg ? "h-5 w-5" : "h-4 w-4"} group-hover:-translate-x-0.5 transition-transform`} />}
        </button>
      </div>
    );
  }

  // EĞER GİRİŞ YAPMAMIŞSA NORMAL GİRİŞ BUTONUNU GÖSTER
  const labels: Record<Phase, string> = {
    idle: "Connect Wallet",
    signing: "Sign in Phantom…",
    redirecting: "Redirecting…",
    disconnecting: "Disconnecting...",
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