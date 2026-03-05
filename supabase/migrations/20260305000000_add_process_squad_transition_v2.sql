-- ============================================================================
-- Migration: process_squad_transition_v2
-- Date: 2026-03-05
-- Purpose: V2 governance RPC — role-free, timestamp-aware squad transitions
--          Called by executeSquadTransitionAction in arena.ts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_squad_transition_v2(
  p_project_id UUID,
  p_actor      TEXT,
  p_target     TEXT,
  p_action     squad_action_t,
  p_nonce      TEXT,
  p_signature  TEXT,
  p_timestamp  BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor_member  RECORD;
  v_target_member RECORD;
  v_result        JSON;
  v_new_status    squad_status_t;
  v_role_to_set   TEXT := 'Member';
BEGIN
  -- ── 1. Nonce replay guard ──────────────────────────────────────────────
  INSERT INTO auth_nonces (nonce, wallet_address, action)
  VALUES (p_nonce, p_actor, p_action::TEXT);
  -- UNIQUE constraint on (nonce, wallet_address) will raise 23505 on replay

  -- ── 2. Resolve actor membership (via profiles.id, not users.id) ───────
  SELECT * INTO v_actor_member
  FROM squad_members
  WHERE project_id = p_project_id
    AND user_id = (
      SELECT id FROM profiles WHERE wallet_address = p_actor LIMIT 1
    )
    AND status = 'active'
  LIMIT 1;

  -- ── 3. Resolve target membership (via profiles.id, not users.id) ─────
  SELECT * INTO v_target_member
  FROM squad_members
  WHERE project_id = p_project_id
    AND user_id = (
      SELECT id FROM profiles WHERE wallet_address = p_target LIMIT 1
    )
  LIMIT 1;

  -- ── 4. Action dispatch ─────────────────────────────────────────────────
  CASE p_action

    -- ── ACCEPT INVITE ──────────────────────────────────────────────────
    WHEN 'accept_invite' THEN
      IF v_target_member IS NULL OR v_target_member.status != 'pending_invite' THEN
        RETURN json_build_object('success', false, 'message', 'No pending invite found.');
      END IF;
      -- Actor must be the target (self-action)
      IF p_actor != p_target THEN
        RETURN json_build_object('success', false, 'message', 'Only the invited user can accept.');
      END IF;

      UPDATE squad_members
      SET status = 'active', joined_at = NOW()
      WHERE id = v_target_member.id AND status = 'pending_invite';

      v_new_status := 'active';

    -- ── REJECT INVITE ──────────────────────────────────────────────────
    WHEN 'reject_invite' THEN
      IF v_target_member IS NULL OR v_target_member.status != 'pending_invite' THEN
        RETURN json_build_object('success', false, 'message', 'No pending invite found.');
      END IF;
      IF p_actor != p_target THEN
        RETURN json_build_object('success', false, 'message', 'Only the invited user can reject.');
      END IF;

      UPDATE squad_members
      SET status = 'rejected', left_at = NOW()
      WHERE id = v_target_member.id AND status = 'pending_invite';

      v_new_status := 'rejected';

    -- ── REVOKE INVITE ──────────────────────────────────────────────────
    WHEN 'revoke_invite' THEN
      IF v_actor_member IS NULL OR v_actor_member.role != 'Leader' THEN
        RETURN json_build_object('success', false, 'message', 'Only the leader can revoke invites.');
      END IF;
      IF v_target_member IS NULL OR v_target_member.status != 'pending_invite' THEN
        RETURN json_build_object('success', false, 'message', 'No pending invite to revoke.');
      END IF;

      UPDATE squad_members
      SET status = 'revoked', left_at = NOW()
      WHERE id = v_target_member.id AND status = 'pending_invite';

      v_new_status := 'revoked';

    -- ── APPROVE APPLICATION ────────────────────────────────────────────
    WHEN 'approve_app' THEN
      IF v_actor_member IS NULL OR v_actor_member.role != 'Leader' THEN
        RETURN json_build_object('success', false, 'message', 'Only the leader can approve applications.');
      END IF;
      IF v_target_member IS NULL OR v_target_member.status != 'pending_application' THEN
        RETURN json_build_object('success', false, 'message', 'No pending application found.');
      END IF;

      UPDATE squad_members
      SET status = 'active', joined_at = NOW()
      WHERE id = v_target_member.id AND status = 'pending_application';

      v_new_status := 'active';

    -- ── REJECT APPLICATION ─────────────────────────────────────────────
    WHEN 'reject_app' THEN
      IF v_actor_member IS NULL OR v_actor_member.role != 'Leader' THEN
        RETURN json_build_object('success', false, 'message', 'Only the leader can reject applications.');
      END IF;
      IF v_target_member IS NULL OR v_target_member.status != 'pending_application' THEN
        RETURN json_build_object('success', false, 'message', 'No pending application found.');
      END IF;

      UPDATE squad_members
      SET status = 'rejected', left_at = NOW()
      WHERE id = v_target_member.id AND status = 'pending_application';

      v_new_status := 'rejected';

    -- ── KICK ───────────────────────────────────────────────────────────
    WHEN 'kick' THEN
      IF v_actor_member IS NULL OR v_actor_member.role != 'Leader' THEN
        RETURN json_build_object('success', false, 'message', 'Only the leader can kick members.');
      END IF;
      IF v_target_member IS NULL OR v_target_member.status != 'active' THEN
        RETURN json_build_object('success', false, 'message', 'Target is not an active member.');
      END IF;
      IF p_actor = p_target THEN
        RETURN json_build_object('success', false, 'message', 'Leader cannot kick themselves. Use leave.');
      END IF;

      UPDATE squad_members
      SET status = 'kicked', left_at = NOW()
      WHERE id = v_target_member.id AND status = 'active';

      v_new_status := 'kicked';

    -- ── LEAVE ──────────────────────────────────────────────────────────
    WHEN 'leave' THEN
      IF v_actor_member IS NULL OR v_actor_member.status != 'active' THEN
        RETURN json_build_object('success', false, 'message', 'You are not an active member.');
      END IF;
      IF p_actor != p_target THEN
        RETURN json_build_object('success', false, 'message', 'You can only leave for yourself.');
      END IF;

      UPDATE squad_members
      SET status = 'left', left_at = NOW()
      WHERE id = v_actor_member.id AND status = 'active';

      v_new_status := 'left';

    ELSE
      RETURN json_build_object('success', false, 'message', 'Unknown action: ' || p_action::TEXT);
  END CASE;

  -- ── 5. Log the transition ─────────────────────────────────────────────
  INSERT INTO squad_transition_logs (
    project_id, actor_wallet, target_wallet, action_type,
    role, nonce, signature_hash, protocol_version
  ) VALUES (
    p_project_id, p_actor, p_target, p_action::TEXT,
    v_role_to_set, p_nonce, encode(digest(p_signature, 'sha256'), 'hex'), 2
  );

  -- ── 6. Recalculate project trust ──────────────────────────────────────
  PERFORM recalculate_project_trust(p_project_id);

  RETURN json_build_object(
    'success', true,
    'message', 'Transition executed: ' || p_action::TEXT,
    'new_status', v_new_status::TEXT
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'message', 'Replay attack detected. Nonce already used.');
  WHEN OTHERS THEN
    RAISE WARNING '[process_squad_transition_v2] %: %', SQLSTATE, SQLERRM;
    RETURN json_build_object('success', false, 'message', 'Internal governance error.');
END;
$fn$;

-- Grant execute to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.process_squad_transition_v2(UUID, TEXT, TEXT, squad_action_t, TEXT, TEXT, BIGINT)
  TO authenticated, service_role;

-- Enable pgcrypto if not already (needed for digest/sha256)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
