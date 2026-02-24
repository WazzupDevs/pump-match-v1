import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Pump Match] Missing Supabase environment variables.\n' +
    'Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
    'Add them to your .env.local file and restart the server.'
  );
}

// Public client — uses anon key, subject to RLS policies.
// Safe to use for read-only queries from server actions.
export const supabase = createClient(supabaseUrl, supabaseKey);

// Server-side admin client — uses service_role key, bypasses RLS.
// ONLY import this in server actions (lib/db.ts, app/actions/**).
// NEVER expose to the client bundle (no "use client" files).
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : supabase; // fallback to anon in local dev when key is not set