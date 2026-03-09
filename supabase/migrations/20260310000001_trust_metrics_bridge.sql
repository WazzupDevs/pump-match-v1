-- ============================================================================
-- Migration: Intelligence Core V2 - Arena Trust Metrics Bridge (Phase 2A-3)
-- Date: 2026-03-10
-- Purpose:
--   Add temporary, denormalized bridge columns on public.trust_metrics so
--   Arena / legacy consumers can read Intelligence Core v2 fields without
--   directly joining score_snapshots.
--
-- IMPORTANT:
--   - score_snapshots remains the sole source of truth for intelligence.
--   - These fields are WRITE-THROUGH / DENORMALIZED BRIDGE ONLY.
--   - This migration is ADDITIVE-ONLY (no drops / no column removals).
-- ============================================================================

ALTER TABLE public.trust_metrics
  ADD COLUMN IF NOT EXISTS latest_snapshot_id uuid,
  ADD COLUMN IF NOT EXISTS primary_style text,
  ADD COLUMN IF NOT EXISTS quality_overall integer,
  ADD COLUMN IF NOT EXISTS suspiciousness integer,
  ADD COLUMN IF NOT EXISTS confidence_tier text,
  ADD COLUMN IF NOT EXISTS score_label text;

-- Denormalized pointer to the canonical intelligence snapshot.
COMMENT ON COLUMN public.trust_metrics.latest_snapshot_id IS
  'Temporary denormalized bridge to score_snapshots.id; score_snapshots is the source of truth.';

-- Primary style label copied from Intelligence Core v2 (e.g. "Conviction Holder").
COMMENT ON COLUMN public.trust_metrics.primary_style IS
  'Temporary denormalized bridge: primary trading style from Intelligence Core v2.';

-- Overall quality axis (0-100) copied from Intelligence Core v2.
COMMENT ON COLUMN public.trust_metrics.quality_overall IS
  'Temporary denormalized bridge: overall quality score from Intelligence Core v2.';

-- Suspiciousness / risk axis (0-100) copied from Intelligence Core v2.
COMMENT ON COLUMN public.trust_metrics.suspiciousness IS
  'Temporary denormalized bridge: suspiciousness score from Intelligence Core v2.';

-- Confidence tier string (LOW / MEDIUM / HIGH) from Intelligence Core v2.
COMMENT ON COLUMN public.trust_metrics.confidence_tier IS
  'Temporary denormalized bridge: confidence tier from Intelligence Core v2.';

-- Canonical human-readable score label produced by Intelligence Core v2.
COMMENT ON COLUMN public.trust_metrics.score_label IS
  'Temporary denormalized bridge: canonical score label from Intelligence Core v2. Do not recompute in Arena.';

