// components/providers/SquadProvider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";

type SquadAuthCtx = {
  ready: boolean;
  userId: string | null;
  walletAddress: string | null;
  twitterHandle: string | null;
  /** Call to clear auth state immediately (e.g. on disconnect click). Ensures UI updates even if signOut event is delayed. */
  clearAuthState: () => void;
};

const Ctx = createContext<SquadAuthCtx>({
  ready: false,
  userId: null,
  walletAddress: null,
  twitterHandle: null,
  clearAuthState: () => {},
});

/** Extract the Twitter handle from session identity data (no extra RPC needed). */
function extractTwitterHandle(session: Session | null): string | null {
  const identity = session?.user?.identities?.find(
    (i) => i.provider === "twitter"
  );
  return (
    (identity?.identity_data?.user_name as string | undefined) ??
    (identity?.identity_data?.screen_name as string | undefined) ??
    null
  );
}

/**
 * Full profile sync: call ensure_wallet_profile to get (or create) the wallet
 * record and return the wallet address.
 */
async function fetchWalletAddress(): Promise<string | null> {
  const { data, error } = await supabase.rpc("ensure_wallet_profile");
  if (error) {
    console.error("[SquadProvider] ensure_wallet_profile RPC error:", error);
    return null;
  }
  // RPC returns jsonb: { wallet_address, verified_x_handle, id }
  // or on failure: { error: "reason_code" }
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (obj.error) {
    console.error("[SquadProvider] ensure_wallet_profile returned:", obj.error);
    return null;
  }
  const raw = obj.wallet_address;
  if (typeof raw !== "string" || raw.length === 0) return null;
  let addr: string = raw;
  // Supabase Web3 Auth may store identity as "web3:solana:<base58>" — strip prefix
  if (addr.startsWith("web3:solana:")) addr = addr.slice("web3:solana:".length);
  return addr;
}

export function SquadProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [twitterHandle, setTwitterHandle] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        await supabase.realtime.setAuth(session?.access_token ?? "");

        if (event === "TOKEN_REFRESHED") return;

        if (event === "USER_UPDATED") {
          if (mountedRef.current) setTwitterHandle(extractTwitterHandle(session));
          return;
        }

        if (!session?.user?.id) {
          if (mountedRef.current) {
            setUserId(null);
            setWalletAddress(null);
            setTwitterHandle(null);
            setReady(true);
          }
          return;
        }

        if (mountedRef.current) {
          setUserId(session.user.id);
          setTwitterHandle(extractTwitterHandle(session));
        }

        const addr = await fetchWalletAddress();
        if (!mountedRef.current) return;
        setWalletAddress(addr);
        setReady(true);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const clearAuthState = useCallback(() => {
    if (!mountedRef.current) return;
    setUserId(null);
    setWalletAddress(null);
    setTwitterHandle(null);
    setReady(true);
  }, []);

  const value = useMemo(
    () => ({ ready, userId, walletAddress, twitterHandle, clearAuthState }),
    [ready, userId, walletAddress, twitterHandle, clearAuthState]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSquadAuth() {
  return useContext(Ctx);
}
