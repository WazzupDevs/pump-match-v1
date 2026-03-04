import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "[PumpMatch] Missing Supabase environment variables.\n" +
      "Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY\n" +
      "Add them to your .env.local file and restart the server."
  );
}

/**
 * Browser-side singleton client.
 * - Subject to RLS policies.
 * - Session persisted in localStorage.
 * - PKCE flow: the authorization code returned by Supabase after OAuth is
 *   automatically detected and exchanged by detectSessionInUrl.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Server-side admin client — bypasses RLS entirely.
 * Import ONLY inside server actions (lib/db.ts, app/actions/**).
 * NEVER import in any "use client" file.
 */
import 'server-only';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey && process.env.NODE_ENV === "production") {
  // Hard fail in production to avoid silent privilege escalation bugs.
  throw new Error(
    "[PumpMatch] SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "This is required in production for server-side operations."
  );
}

export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : // Dev-only fallback: anon client with a loud warning so it's obvious.
    (() => {
      console.warn(
        "[PumpMatch] supabaseAdmin is using the anon client (dev fallback). " +
          "Set SUPABASE_SERVICE_ROLE_KEY in .env.local for full admin access."
      );
      return supabase;
    })();
