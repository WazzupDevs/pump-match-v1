-- ──────────────────────────────────────────────────────────────
-- Migration: Create Endorsements + Fix RLS Policies & auth_nonces TTL
-- Date: 2026-02-25
-- Project: PumpMatch
-- ──────────────────────────────────────────────────────────────

-- ─── 0. ENDORSEMENTS TABLE (TABLOYU OLUŞTURUYORUZ) ────────────
-- Sütun adları lib/db.ts ile eşleşmeli: from_wallet / to_wallet
CREATE TABLE IF NOT EXISTS "public"."endorsements" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "from_wallet" text NOT NULL,
    "to_wallet"   text NOT NULL,
    "created_at"  timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE ("from_wallet", "to_wallet")
);

-- Trust score hesaplamalarını hızlandırmak için index
CREATE INDEX IF NOT EXISTS idx_endorsements_to_wallet ON "public"."endorsements" ("to_wallet");

-- ─── 1. USERS TABLE ───────────────────────────────────────────
DROP POLICY IF EXISTS "Enable read/write for all" ON "public"."users";
DROP POLICY IF EXISTS "users_anon_select" ON "public"."users";

CREATE POLICY "users_anon_select"
  ON "public"."users"
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (is_opted_in = true);

-- ─── 2. SQUAD_PROJECTS TABLE ──────────────────────────────────
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."squad_projects";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."squad_projects";
DROP POLICY IF EXISTS "squad_projects_anon_select" ON "public"."squad_projects";

CREATE POLICY "squad_projects_anon_select"
  ON "public"."squad_projects"
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (true);

-- ─── 3. SQUAD_MEMBERS TABLE ───────────────────────────────────
ALTER TABLE "public"."squad_members" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."squad_members";
DROP POLICY IF EXISTS "squad_members_anon_select" ON "public"."squad_members";

CREATE POLICY "squad_members_anon_select"
  ON "public"."squad_members"
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (true);

-- ─── 4. ENDORSEMENTS TABLE RLS (GÜVENLİK POLİTİKASI) ──────────
ALTER TABLE "public"."endorsements" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "endorsements_anon_select" ON "public"."endorsements";

CREATE POLICY "endorsements_anon_select"
  ON "public"."endorsements"
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (true);

-- ─── 5. AUTH_NONCES TABLE ─────────────────────────────────────
ALTER TABLE "public"."auth_nonces" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."auth_nonces";
DROP POLICY IF EXISTS "Enable insert for all users" ON "public"."auth_nonces";

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