-- ──────────────────────────────────────────────────────────────
-- Migration: Add missing columns to users table
-- Date: 2026-02-26
-- Project: PumpMatch
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}';
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "social_links" jsonb DEFAULT '{}';
