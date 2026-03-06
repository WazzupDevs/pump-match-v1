-- ============================================================================
-- Migration: Squad OS Tables
-- Date: 2026-03-06
-- Purpose:
--   1. Add ops_status + ops_description columns to squad_projects
--   2. Create squad_role_slots table (role capacity per project)
--   3. Create squad_split_proposals table (revenue split proposals)
--   4. Create squad_split_shares table (individual BPS allocations)
--   5. Create squad_split_signatures table (cryptographic agreement)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- Part 1: Extend squad_projects with ops columns
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.squad_projects
  ADD COLUMN IF NOT EXISTS ops_status TEXT NOT NULL DEFAULT 'forming'
    CHECK (ops_status IN ('forming', 'recruiting', 'split_proposed', 'signing', 'launch_ready')),
  ADD COLUMN IF NOT EXISTS ops_description TEXT,
  ADD COLUMN IF NOT EXISTS ops_website TEXT,
  ADD COLUMN IF NOT EXISTS ops_twitter TEXT,
  ADD COLUMN IF NOT EXISTS ops_discord TEXT;

-- ────────────────────────────────────────────────────────────────────────────
-- Part 2: squad_role_slots — defines capacity per role in a squad
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.squad_role_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.squad_projects(id) ON DELETE CASCADE,
  role_label      TEXT NOT NULL,           -- e.g. 'DEV', 'MKT', 'OPS', 'COMMUNITY'
  max_count       INTEGER NOT NULL DEFAULT 1 CHECK (max_count >= 1),
  min_trust_score INTEGER NOT NULL DEFAULT 0 CHECK (min_trust_score >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, role_label)
);

CREATE INDEX IF NOT EXISTS idx_squad_role_slots_project
  ON public.squad_role_slots(project_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Part 3: squad_split_proposals — a revenue split proposal for a project
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.squad_split_proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.squad_projects(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  total_bps       INTEGER NOT NULL DEFAULT 10000 CHECK (total_bps = 10000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Only one active (pending/accepted) proposal per project
  UNIQUE (project_id, status) -- partial unique via index below
);

-- Ensure only one pending proposal per project at a time
DROP INDEX IF EXISTS idx_unique_pending_proposal;
CREATE UNIQUE INDEX idx_unique_pending_proposal
  ON public.squad_split_proposals(project_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_squad_split_proposals_project
  ON public.squad_split_proposals(project_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Part 4: squad_split_shares — individual BPS allocation per member
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.squad_split_shares (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES public.squad_split_proposals(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  bps             INTEGER NOT NULL CHECK (bps >= 0 AND bps <= 10000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_split_shares_proposal
  ON public.squad_split_shares(proposal_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Part 5: squad_split_signatures — cryptographic agreement to a proposal
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.squad_split_signatures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     UUID NOT NULL REFERENCES public.squad_split_proposals(id) ON DELETE CASCADE,
  signer_user_id  UUID NOT NULL REFERENCES public.profiles(id),
  signature       TEXT NOT NULL,
  payload_hash    TEXT NOT NULL,
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (proposal_id, signer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_split_signatures_proposal
  ON public.squad_split_signatures(proposal_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Part 6: RLS Policies
-- ────────────────────────────────────────────────────────────────────────────

-- Enable RLS on new tables
ALTER TABLE public.squad_role_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_split_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_split_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_split_signatures ENABLE ROW LEVEL SECURITY;

-- squad_role_slots: read by anyone authenticated, write by project leader
CREATE POLICY "squad_role_slots_select" ON public.squad_role_slots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "squad_role_slots_insert" ON public.squad_role_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.squad_members sm
      WHERE sm.project_id = squad_role_slots.project_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'Leader'
        AND sm.status = 'active'
    )
  );

CREATE POLICY "squad_role_slots_update" ON public.squad_role_slots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members sm
      WHERE sm.project_id = squad_role_slots.project_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'Leader'
        AND sm.status = 'active'
    )
  );

CREATE POLICY "squad_role_slots_delete" ON public.squad_role_slots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members sm
      WHERE sm.project_id = squad_role_slots.project_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'Leader'
        AND sm.status = 'active'
    )
  );

-- squad_split_proposals: read by squad members, write by project leader
CREATE POLICY "squad_split_proposals_select" ON public.squad_split_proposals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "squad_split_proposals_insert" ON public.squad_split_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.squad_members sm
      WHERE sm.project_id = squad_split_proposals.project_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'Leader'
        AND sm.status = 'active'
    )
  );

-- squad_split_shares: read by authenticated, insert by leader (via proposal)
CREATE POLICY "squad_split_shares_select" ON public.squad_split_shares
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "squad_split_shares_insert" ON public.squad_split_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.squad_split_proposals sp
      JOIN public.squad_members sm ON sm.project_id = sp.project_id
      WHERE sp.id = squad_split_shares.proposal_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'Leader'
        AND sm.status = 'active'
    )
  );

-- squad_split_signatures: read by authenticated, insert by the signer themselves
CREATE POLICY "squad_split_signatures_select" ON public.squad_split_signatures
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "squad_split_signatures_insert" ON public.squad_split_signatures
  FOR INSERT TO authenticated
  WITH CHECK (signer_user_id = auth.uid());

-- squad_projects ops columns: update by leader
CREATE POLICY "squad_projects_update_ops" ON public.squad_projects
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members sm
      WHERE sm.project_id = squad_projects.id
        AND sm.user_id = auth.uid()
        AND sm.role = 'Leader'
        AND sm.status = 'active'
    )
  );

-- Grant access to authenticated and service_role
GRANT ALL ON public.squad_role_slots TO authenticated, service_role;
GRANT ALL ON public.squad_split_proposals TO authenticated, service_role;
GRANT ALL ON public.squad_split_shares TO authenticated, service_role;
GRANT ALL ON public.squad_split_signatures TO authenticated, service_role;
