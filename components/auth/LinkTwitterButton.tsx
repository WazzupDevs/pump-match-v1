"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// LinkTwitterButton
// ---------------------------------------------------------------------------

export function LinkTwitterButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLink = async () => {
    setLoading(true);
    setError(null);

    try {
      // Verify the wallet session is alive before starting the OAuth redirect.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(
          "No active wallet session. Please sign in with your wallet first."
        );
      }

      // Proactively refresh the token so it won't expire mid-OAuth-flow.
      await supabase.auth.refreshSession();

      const { data, error: linkError } = await supabase.auth.linkIdentity({
        provider: "twitter",
        options: {
          // All OAuth callbacks are funnelled through this route handler.
          // It normalises errors and passes the PKCE code to the client.
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (linkError) throw linkError;

      if (!data?.url) {
        throw new Error("Supabase did not return a redirect URL.");
      }

      window.location.assign(data.url);
    } catch (e: any) {
      setError(e?.message ?? "Twitter linking failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        disabled={loading}
        onClick={() => void handleLink()}
        className="bg-[#1DA1F2] hover:bg-[#1A8CD8] text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
      >
        {loading ? "Redirecting to X..." : "Connect X Account"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TwitterLinkSync — mounts on any page that can receive the OAuth callback.
// Renders nothing when idle; shows inline status during processing.
// ---------------------------------------------------------------------------

type SyncStatus = "idle" | "waiting" | "syncing" | "success" | "error";

type TwitterSyncResult = { ok: boolean; reason?: string };

function normalizeTwitterSyncResult(data: unknown): TwitterSyncResult {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, reason: "invalid_response" };
  }
  const obj = data as Record<string, unknown>;
  const ok = typeof obj.ok === "boolean" ? obj.ok : false;
  const reason = typeof obj.reason === "string" ? obj.reason : undefined;
  return { ok, reason };
}

/**
 * Call sync_my_twitter_identity with exponential-backoff retries.
 *
 * Supabase's DB write for the new identity can lag a few hundred ms behind the
 * session update. We retry on "twitter_not_linked" (soft failure) but bail
 * immediately on hard errors (auth errors, missing wallet profile, etc.).
 */
async function syncWithRetry(): Promise<TwitterSyncResult> {
  const DELAYS = [800, 1600, 3000, 5000, 8000]; // ~18 s total max wait

  for (let attempt = 0; attempt < DELAYS.length; attempt++) {
    const { data, error } = await supabase.rpc("sync_my_twitter_identity");

    if (error) {
      // A hard Postgres/network error — no point retrying.
      throw new Error(error.message);
    }

    const result = normalizeTwitterSyncResult(data);
    if (result.ok) return result;

    // Soft failure: identity write hasn't propagated yet. Back off and retry.
    if (result.reason === "twitter_not_linked") {
      await new Promise((r) => setTimeout(r, DELAYS[attempt]));
      continue;
    }

    // Any other reason (wallet_not_found, not_authenticated…) — fail fast.
    return result;
  }

  return { ok: false, reason: "max_retries_exceeded" };
}

export function TwitterLinkSync() {
  const sp = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  // Prevents double-execution under React 18 StrictMode (double-mount).
  const handledRef = useRef(false);

  useEffect(() => {
    // Only activate when we're returning from the Twitter OAuth flow.
    if (sp.get("linked") !== "twitter") return;

    // -----------------------------------------------------------------------
    // Core handler: called once we have a session we trust.
    // -----------------------------------------------------------------------
    const handleSession = async (session: Session | null) => {
      if (handledRef.current) return;
      handledRef.current = true;

      // Check if Twitter identity is actually present in this session.
      // If it's missing, the OAuth link failed (user denied, ghost account, etc.)
      const twitterIdentity = session?.user?.identities?.find(
        (id) => id.provider === "twitter"
      );

      if (!twitterIdentity) {
        const urlError = sp.get("error");
        setStatus("error");
        setMessage(
          urlError === "access_denied"
            ? "You denied access to your X account. No changes were made."
            : "X identity was not linked to your wallet. If a duplicate account was created, please contact support."
        );
        return;
      }

      setStatus("syncing");

      try {
        const result = await syncWithRetry();
        if (result.ok) {
          setStatus("success");
          // Brief success flash, then clean up the URL.
          setTimeout(() => router.replace("/command-center"), 2000);
        } else {
          setStatus("error");
          setMessage(
            `Sync failed (${result.reason ?? "unknown"}). Please try again.`
          );
        }
      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message ?? "An unexpected error occurred during sync.");
      }
    };

    setStatus("waiting");

    // -----------------------------------------------------------------------
    // Race-condition-safe session detection.
    //
    // Problem: supabase-js exchanges the PKCE code asynchronously after page
    // load. If we call getSession() immediately, the exchange may not be done
    // yet, so we'd see the OLD session (without Twitter).
    //
    // Solution:
    //   1. Subscribe to onAuthStateChange FIRST (no events are missed).
    //   2. Then check getSession() — if Twitter is already there, handle it
    //      and cancel the subscription.
    //   3. If not yet there, the subscription fires once the PKCE exchange
    //      completes and we handle it then.
    // -----------------------------------------------------------------------
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Unsubscribe immediately so we only process the first update.
      subscription.unsubscribe();
      void handleSession(session);
    });

    // Check whether the session is already updated (exchange completed before mount).
    supabase.auth.getSession().then(({ data: { session } }) => {
      const alreadyLinked = session?.user?.identities?.some(
        (id) => id.provider === "twitter"
      );
      if (alreadyLinked) {
        subscription.unsubscribe(); // cancel the listener — we're done waiting
        void handleSession(session);
      }
      // Otherwise we wait for the onAuthStateChange to fire.
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Intentionally empty — run exactly once on mount.

  if (status === "idle") return null;

  const config: Record<
    Exclude<SyncStatus, "idle">,
    { color: string; text: string }
  > = {
    waiting: {
      color: "text-slate-400",
      text: "Verifying X session…",
    },
    syncing: {
      color: "text-sky-400",
      text: "Syncing your X profile…",
    },
    success: {
      color: "text-emerald-400",
      text: "X account linked successfully! Redirecting…",
    },
    error: {
      color: "text-red-400",
      text: message ?? "An error occurred.",
    },
  };

  const { color, text } = config[status];

  return (
    <div
      className={`mt-4 p-3 rounded-lg bg-slate-900 border border-slate-700 text-sm ${color}`}
    >
      {text}
    </div>
  );
}
