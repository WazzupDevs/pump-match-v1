// components/providers/SquadProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type SquadAuthCtx = {
  ready: boolean;
  userId: string | null;
  walletAddress: string | null;
  twitterHandle: string | null;
};

const Ctx = createContext<SquadAuthCtx>({
  ready: false,
  userId: null,
  walletAddress: null,
  twitterHandle: null,
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
 * Only called on INITIAL_SESSION and SIGNED_IN — not on every token refresh
 * or identity update.
 */
async function fetchWalletAddress(): Promise<string | null> {
  const { data } = await supabase.rpc("ensure_wallet_profile");
  return (data?.wallet_address as string | undefined) ?? null;
}

export function SquadProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [twitterHandle, setTwitterHandle] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Always keep Realtime authorised with the latest token.
        await supabase.realtime.setAuth(session?.access_token ?? "");

        if (event === "TOKEN_REFRESHED") {
          // Token silently refreshed — no profile state has changed.
          return;
        }

        if (event === "USER_UPDATED") {
          // Fires when Twitter (or another identity) is linked.
          // Only update the Twitter handle from the new session data;
          // the wallet address hasn't changed so skip the RPC.
          setTwitterHandle(extractTwitterHandle(session));
          return;
        }

        // INITIAL_SESSION, SIGNED_IN, SIGNED_OUT (and any other events)
        if (!session?.user?.id) {
          setUserId(null);
          setWalletAddress(null);
          setTwitterHandle(null);
          setReady(true);
          return;
        }

        setUserId(session.user.id);
        setTwitterHandle(extractTwitterHandle(session));

        const addr = await fetchWalletAddress();
        setWalletAddress(addr);
        setReady(true);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ ready, userId, walletAddress, twitterHandle }),
    [ready, userId, walletAddress, twitterHandle]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSquadAuth() {
  return useContext(Ctx);
}
