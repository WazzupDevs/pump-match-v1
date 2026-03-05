-- ============================================================================
-- Migration: Fix recalculate_project_trust
-- Date: 2026-03-05
-- Purpose: squad_projects.created_by stores a wallet address (TEXT), not a UUID.
--          The old function cast it to UUID causing 22P02 errors.
--          Fix: resolve founder UUID via profiles.wallet_address join.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_project_trust(p_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_founder_id UUID;
  v_founder_score INTEGER := 0;
  v_squad_avg_score NUMERIC := 0;
  v_squad_member_count INTEGER := 0;
  v_final_score INTEGER := 0;
  v_risk_band TEXT;
  v_founder_status TEXT;
BEGIN
  -- Resolve founder UUID: created_by is a wallet address (TEXT), not a UUID.
  -- Join through profiles to get the UUID that trust_metrics references.
  SELECT p.id INTO v_founder_id
  FROM squad_projects sp
  JOIN profiles p ON p.wallet_address = sp.created_by
  WHERE sp.id = p_project_id;

  IF v_founder_id IS NOT NULL THEN
    SELECT dev_score, tier INTO v_founder_score, v_founder_status
    FROM trust_metrics
    WHERE user_id = v_founder_id;

    IF v_founder_status = 'EXILED' THEN
      UPDATE squad_projects
      SET project_trust_score = 0, project_risk_band = 'RUGGED'
      WHERE id = p_project_id;
      RETURN;
    END IF;
  END IF;

  SELECT COALESCE(AVG(tm.dev_score), 0), COUNT(sm.id)
  INTO v_squad_avg_score, v_squad_member_count
  FROM squad_members sm
  JOIN trust_metrics tm ON tm.user_id = sm.user_id
  WHERE sm.project_id = p_project_id AND sm.status = 'active';

  IF v_squad_member_count = 0 THEN
    v_final_score := COALESCE(v_founder_score, 0);
  ELSE
    v_final_score := ROUND((COALESCE(v_founder_score, 0) * 0.6) + (v_squad_avg_score * 0.4));
  END IF;

  IF v_final_score >= 800 THEN v_risk_band := 'SAFE';
  ELSIF v_final_score >= 600 THEN v_risk_band := 'LOW_RISK';
  ELSIF v_final_score >= 400 THEN v_risk_band := 'MEDIUM';
  ELSIF v_final_score >= 200 THEN v_risk_band := 'HIGH';
  ELSE v_risk_band := 'EXTREME';
  END IF;

  UPDATE squad_projects
  SET project_trust_score = v_final_score, project_risk_band = v_risk_band
  WHERE id = p_project_id;
END;
$function$;
