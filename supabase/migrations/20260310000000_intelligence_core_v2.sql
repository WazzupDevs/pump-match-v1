-- ============================================================================
-- Migration: Intelligence Core V2 - Foundation (Phase 2A-2)
-- Date: 2026-03-10
-- Purpose:
--   1. Create canonical storage for intelligence score snapshots
--   2. Create wallet_receipts for shareable receipts
--   3. Add visibility_mode and latest_snapshot_id to users (additive only)
--   4. Expose read-only views for public receipts and latest intelligence
-- NOTE:
--   - This migration is ADDITIVE ONLY.
--   - Does NOT drop or modify existing columns or tables.
--   - Does NOT touch trust_score or existing Arena logic.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) ENUM: visibility_mode_t (for users.visibility_mode)
-- ────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'visibility_mode_t'
  ) THEN
    CREATE TYPE public.visibility_mode_t AS ENUM (
      'GHOST',
      'CLAIMED_PRIVATE',
      'PUBLIC',
      'VERIFIED_PUBLIC'
    );
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Table: score_snapshots
-- Canonical storage for deterministic intelligence snapshots per wallet.
-- Source of truth for Intelligence Core v2.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.score_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text        NOT NULL,
  model_version  text        NOT NULL, -- e.g. 'v2.0', 'v2.1'
  score_window   text        NOT NULL, -- e.g. '7d', '30d', '90d', 'all'
  style          jsonb       NOT NULL, -- StyleScores
  quality        jsonb       NOT NULL, -- QualityScores
  risk           jsonb       NOT NULL, -- RiskScores
  confidence     jsonb       NOT NULL, -- IntelligenceConfidence
  summary        jsonb       NOT NULL, -- IntelligenceSummary
  sample_size    integer     NOT NULL,
  computed_at    bigint      NOT NULL  -- epoch millis for deterministic ordering
);

ALTER TABLE public.score_snapshots ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Table: wallet_receipts
-- Shareable receipts that point to a specific score_snapshot.
-- Visibility is controlled by visibility_mode on the receipt itself.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wallet_receipts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id       text        NOT NULL, -- externally shareable identifier/slug
  wallet_address text        NOT NULL,
  snapshot_id    uuid        NOT NULL REFERENCES public.score_snapshots(id) ON DELETE CASCADE,
  visibility     public.visibility_mode_t NOT NULL DEFAULT 'PUBLIC',
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz
);

ALTER TABLE public.wallet_receipts ENABLE ROW LEVEL SECURITY;

-- Optional uniqueness on share_id to prevent collisions (additive-only)
CREATE UNIQUE INDEX IF NOT EXISTS wallet_receipts_share_id_key
  ON public.wallet_receipts (share_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Additive columns on users
-- - visibility_mode: governs how wallet is exposed in public surfaces
-- - latest_snapshot_id: denormalized pointer to most recent score_snapshot
-- NOTE: Both columns are additive and nullable-safe.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS visibility_mode public.visibility_mode_t
    DEFAULT 'GHOST'::public.visibility_mode_t;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS latest_snapshot_id uuid;

-- ────────────────────────────────────────────────────────────────────────────
-- 5) View: v_public_receipts
-- Publicly consumable receipts with non-expired visibility.
-- Source: wallet_receipts (score_snapshots remains source of truth).
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_public_receipts AS
SELECT
  r.id,
  r.share_id,
  r.wallet_address,
  r.snapshot_id,
  r.visibility,
  r.created_at,
  r.expires_at
FROM public.wallet_receipts AS r
WHERE r.visibility IN ('PUBLIC', 'VERIFIED_PUBLIC')
  AND (r.expires_at IS NULL OR r.expires_at > now());

-- ────────────────────────────────────────────────────────────────────────────
-- 6) View: v_wallet_latest_intelligence
-- Read-mostly bridge from users → latest score_snapshot.
-- NOTE:
--   - score_snapshots remains source of truth.
--   - latest_snapshot_id is a denormalized pointer only.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_wallet_latest_intelligence AS
SELECT
  u.id               AS user_id,
  u.wallet_address   AS wallet_address,
  u.visibility_mode  AS visibility_mode,
  u.latest_snapshot_id,
  s.model_version,
  s.score_window,
  s.style,
  s.quality,
  s.risk,
  s.confidence,
  s.summary,
  s.sample_size,
  s.computed_at
FROM public.users AS u
LEFT JOIN public.score_snapshots AS s
  ON s.id = u.latest_snapshot_id;

