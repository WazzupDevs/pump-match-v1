-- ──────────────────────────────────────────────────────────────
-- Migration: Fix RLS Policies + auth_nonces TTL
-- Date: 2026-02-25
-- ──────────────────────────────────────────────────────────────
-- SECURITY: Replace blanket anon full-access policies with
-- restrictive, principle-of-least-privilege policies.
-- All writes now go through supabaseAdmin (service_role) in server
-- actions, so anon role only needs SELECT on specific columns.
-- ──────────────────────────────────────────────────────────────

-- ─── 1. USERS TABLE ───────────────────────────────────────────
-- Drop the blanket permissive policy that allows anon full access
DROP POLICY IF EXISTS "Enable read/write for all" ON "public"."users";

-- Allow anyone to read opted-in user profiles (public directory).
-- Excludes sensitive columns (cached_matches, social_links) via SELECT *
-- but those are fetched only by server actions using service_role.
CREATE POLICY "users_anon_select"
  ON "public"."users"
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (is_opted_in = true);

-- All INSERT/UPDATE/DELETE must come from the service_role (server actions).
-- No anon write policy = anon writes are blocked by default.

-- ─── 2. SQUAD_PROJECTS TABLE ──────────────────────────────────
-- Drop any existing overly-broad policies
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."squad_projects";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."squad_projects";

-- Public read: anyone can browse active squad projects
CREATE POLICY "squad_projects_anon_select"
  ON "public"."squad_projects"
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (true);

-- No anon INSERT/UPDATE/DELETE — all writes via service_role in claimProjectAction.

-- ─── 3. SQUAD_MEMBERS TABLE ───────────────────────────────────
-- Make sure RLS is enabled (it may have been off)
ALTER TABLE "public"."squad_members" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."squad_members";

-- Public read: anyone can see active squad membership (used in squad UI)
CREATE POLICY "squad_members_anon_select"
  ON "public"."squad_members"
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (true);

-- No anon INSERT/UPDATE/DELETE — all writes go through
-- process_squad_transition RPC called with service_role.

-- ─── 4. ENDORSEMENTS TABLE ────────────────────────────────────
-- Public read: endorsement counts are public social proof
CREATE POLICY "endorsements_anon_select"
  ON "public"."endorsements"
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (true);

-- No anon writes — all inserts via service_role in addEndorsement.

-- ─── 5. AUTH_NONCES TABLE ─────────────────────────────────────
-- auth_nonces should NEVER be readable by anon — purely server-side
ALTER TABLE "public"."auth_nonces" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."auth_nonces";
DROP POLICY IF EXISTS "Enable insert for all users" ON "public"."auth_nonces";

-- No anon policies — service_role bypasses RLS for nonce operations.

-- TTL cleanup: automatically delete nonces older than 10 minutes.
-- This prevents the auth_nonces table from growing unbounded.
-- Run as a scheduled function (pg_cron) or call manually.
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth_nonces
  WHERE created_at < NOW() - INTERVAL '10 minutes';
END;
$$;

-- Schedule cleanup every 5 minutes (requires pg_cron extension).
-- Uncomment in Supabase Dashboard → Database → Cron Jobs if pg_cron is enabled.
-- SELECT cron.schedule('cleanup-auth-nonces', '*/5 * * * *', 'SELECT cleanup_expired_nonces()');
