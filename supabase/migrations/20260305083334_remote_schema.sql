alter table "public"."profiles" drop constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_auth_users_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_auth_users_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.acquire_lock(p_key text, p_worker_id text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
declare
  locked boolean;
begin
  insert into public.snapshot_locks (lock_key, locked_at, worker_id)
  values (p_key, now(), p_worker_id)
  on conflict (lock_key)
  do update set
    locked_at = now(),
    worker_id = p_worker_id
  where public.snapshot_locks.locked_at < now() - interval '2 minutes'
  returning true into locked;

  return coalesce(locked, false);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_trust_metrics_for_new_profile()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN INSERT INTO trust_metrics (user_id) VALUES (NEW.id); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.execute_slashing(p_user_id uuid, p_reason text, p_tx_hash text, p_should_slash_stake boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_log_id BIGINT;
BEGIN
  -- 1. Satır Kilidi (Race Condition koruması)
  PERFORM 1 FROM trust_metrics WHERE user_id = p_user_id FOR UPDATE;

  -- 2. EXILED Override Koruması
  IF EXISTS (SELECT 1 FROM trust_metrics WHERE user_id = p_user_id AND tier = 'EXILED') THEN RETURN; END IF;

  -- 3. Idempotency Check
  IF EXISTS (SELECT 1 FROM processed_events WHERE tx_hash = p_tx_hash AND event_type = 'SLASHING_' || p_reason) THEN RETURN; END IF;

  -- 4. Audit Log
  INSERT INTO slashing_logs (user_id, reason, tx_hash, stake_slashed)
  VALUES (p_user_id, p_reason, p_tx_hash, p_should_slash_stake) RETURNING id INTO v_log_id;

  -- 5. İnfaz
  UPDATE trust_metrics
  SET dev_score = 0, composite_score = 0, tier = 'EXILED', consecutive_growth_epochs = 0, updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id;

  -- 6. Mühür
  INSERT INTO processed_events (tx_hash, event_type) VALUES (p_tx_hash, 'SLASHING_' || p_reason);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_squad_transition(p_project_id uuid, p_actor character varying, p_target character varying, p_action character varying, p_role character varying, p_nonce uuid, p_signature character varying)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$DECLARE
    v_founder_wallet VARCHAR(64);
    v_current_status VARCHAR(50);
    v_new_status VARCHAR(50);
    v_now TIMESTAMPTZ := NOW(); -- Deterministic DB timestamp
    v_inserted_sequence BIGINT;
    v_member_record RECORD;
BEGIN
    -- 1. DEADLOCK PREVENTION: Strict Locking Order (Project -> Member)
    -- Lock the project to ensure no parallel actions mutate squad state concurrently.
    SELECT lower(created_by_wallet) INTO v_founder_wallet 
    FROM public.squad_projects 
    WHERE id = p_project_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Project not found or locked.');
    END IF;

    -- Lock the specific member projection (if exists)
    SELECT * INTO v_member_record 
    FROM public.squad_members 
    WHERE project_id = p_project_id AND lower(wallet_address) = lower(p_target)
    FOR UPDATE;

    v_current_status := v_member_record.status;

    -- 2. REPLAY PROTECTION (Atomicity Guarantee)
    -- This insert acts as our ultimate guard. If nonce exists for this actor+project, it throws an Integrity Error.
    BEGIN
        INSERT INTO public.squad_transition_logs (
            project_id, actor_wallet, target_wallet, action_type, role, nonce, signature_hash, created_at
        ) VALUES (
            p_project_id, lower(p_actor), lower(p_target), p_action, p_role, p_nonce, p_signature, v_now
        ) RETURNING sequence_number INTO v_inserted_sequence;
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'message', 'Replay attack detected. Nonce consumed.');
    END;

    -- 3. DETERMINISTIC STATE MACHINE (The Rules of the Protocol)
    
    -- Founder Action: Invite someone to the squad
    IF p_action = 'invite' THEN
        IF lower(p_actor) != v_founder_wallet THEN 
            RAISE EXCEPTION 'Only founder can invite.'; 
        END IF;
        IF v_current_status IS NOT NULL AND v_current_status NOT IN ('rejected', 'left', 'revoked', 'kicked') THEN
            RAISE EXCEPTION 'User already has an active or pending status.';
        END IF;
        v_new_status := 'pending_invite';

    -- User Action: Apply to join a squad
    ELSIF p_action = 'apply' THEN
        IF lower(p_actor) != lower(p_target) THEN 
            RAISE EXCEPTION 'You can only apply for yourself.'; 
        END IF;
        IF v_current_status IS NOT NULL AND v_current_status NOT IN ('rejected', 'left', 'revoked', 'kicked') THEN
            RAISE EXCEPTION 'User already has an active or pending status.';
        END IF;
        v_new_status := 'pending_application';

    -- Founder Action: Approve an application
    ELSIF p_action = 'approve_app' THEN
        IF lower(p_actor) != v_founder_wallet THEN 
            RAISE EXCEPTION 'Only founder can approve.'; 
        END IF;
        IF v_current_status != 'pending_application' THEN 
            RAISE EXCEPTION 'Invalid state transition.'; 
        END IF;
        v_new_status := 'active';

    -- Founder Action: Reject an application
    ELSIF p_action = 'reject_app' THEN
        IF lower(p_actor) != v_founder_wallet THEN RAISE EXCEPTION 'Only founder can reject.'; END IF;
        IF v_current_status != 'pending_application' THEN RAISE EXCEPTION 'Invalid state transition.'; END IF;
        v_new_status := 'rejected';

    -- User Action: Accept an invite
    ELSIF p_action = 'accept_invite' THEN
        IF lower(p_actor) != lower(p_target) THEN RAISE EXCEPTION 'Only invitee can accept.'; END IF;
        IF v_current_status != 'pending_invite' THEN RAISE EXCEPTION 'Invalid state transition.'; END IF;
        v_new_status := 'active';

    -- User Action: Reject an invite
    ELSIF p_action = 'reject_invite' THEN
        IF lower(p_actor) != lower(p_target) THEN RAISE EXCEPTION 'Only invitee can reject.'; END IF;
        IF v_current_status != 'pending_invite' THEN RAISE EXCEPTION 'Invalid state transition.'; END IF;
        v_new_status := 'rejected';

    -- Founder Action: Revoke an invite before acceptance
    ELSIF p_action = 'revoke_invite' THEN
        IF lower(p_actor) != v_founder_wallet THEN RAISE EXCEPTION 'Only founder can revoke.'; END IF;
        IF v_current_status != 'pending_invite' THEN RAISE EXCEPTION 'Invalid state transition.'; END IF;
        v_new_status := 'revoked';

    -- Founder Action: Kick an active member (Negative Impact)
    ELSIF p_action = 'kick' THEN
        IF lower(p_actor) != v_founder_wallet THEN RAISE EXCEPTION 'Only founder can kick.'; END IF;
        IF v_current_status != 'active' THEN RAISE EXCEPTION 'User is not active.'; END IF;
        v_new_status := 'kicked';

    -- User Action: Leave the squad voluntarily (Neutral Impact)
    ELSIF p_action = 'leave' THEN
        IF lower(p_actor) != lower(p_target) THEN RAISE EXCEPTION 'Only the user can leave.'; END IF;
        IF v_current_status != 'active' THEN RAISE EXCEPTION 'User is not active.'; END IF;
        v_new_status := 'left';

    ELSE
        RAISE EXCEPTION 'Unknown protocol action: %', p_action;
    END IF;

    -- 4. IDEMPOTENT PROJECTION UPDATE (CQRS Read Model Synchronization)
    -- We update the 'squad_members' view deterministically based on the new computed state.
    
    IF v_member_record.id IS NULL THEN
        -- Initial Entry (Insert)
        INSERT INTO public.squad_members (
            project_id, wallet_address, role, status, updated_at
        ) VALUES (
            p_project_id, lower(p_target), p_role, v_new_status, v_now
        );
    ELSE
        -- State Mutation (Update)
        UPDATE public.squad_members 
        SET 
            status = v_new_status,
            role = p_role, -- Role can be upgraded/changed during approval
            updated_at = v_now,
            -- Time-Weighting Logic: Start clock if active, stop clock if kicked/left
            joined_at = CASE WHEN v_new_status = 'active' AND v_member_record.joined_at IS NULL THEN v_now ELSE v_member_record.joined_at END,
            left_at = CASE WHEN v_new_status IN ('kicked', 'left') AND v_member_record.left_at IS NULL THEN v_now ELSE v_member_record.left_at END
        WHERE id = v_member_record.id;
    END IF;

    -- At this point, the transaction commits atomically. Log and Projection are perfectly synced.
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Protocol action executed successfully.',
        'new_status', v_new_status,
        'sequence', v_inserted_sequence
    );

EXCEPTION WHEN OTHERS THEN
    -- Complete Rollback on any failure (Rule violations, deadlocks, formatting issues)
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;$function$
;

CREATE OR REPLACE FUNCTION public.process_squad_transition(p_project_id uuid, p_actor character varying, p_target character varying, p_action public.squad_action_t, p_role character varying, p_nonce uuid, p_signature character varying)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$DECLARE
    v_founder_wallet VARCHAR(64);
    v_current_status squad_status_t;
    v_new_status squad_status_t;
    v_now TIMESTAMPTZ := NOW();
    v_inserted_sequence BIGINT;
    v_prev_sequence BIGINT;
    v_member_id UUID;
    v_joined_at TIMESTAMPTZ;
    v_left_at TIMESTAMPTZ;
BEGIN
    -- DEADLOCK ÖNLEME & PROJE KİLİDİ
    SELECT lower(created_by_wallet) INTO v_founder_wallet FROM public.squad_projects WHERE id = p_project_id FOR UPDATE;
    IF NOT FOUND OR v_founder_wallet IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Project locked or not found.'); END IF;

    -- GERÇEK İDEMPOTENT KONTROL
    SELECT sequence_number INTO v_prev_sequence FROM public.squad_transition_logs
    WHERE project_id = p_project_id AND actor_wallet = lower(p_actor) AND nonce = p_nonce;

    IF FOUND THEN
        SELECT status INTO v_current_status FROM public.squad_members WHERE project_id = p_project_id AND lower(wallet_address) = lower(p_target);
        RETURN jsonb_build_object('success', true, 'message', 'Action already processed.', 'new_status', v_current_status, 'sequence', v_prev_sequence);
    END IF;

    -- ÜYEYİ KİLİTLE VE DURUMU AL
    SELECT id, status, joined_at, left_at INTO v_member_id, v_current_status, v_joined_at, v_left_at 
    FROM public.squad_members WHERE project_id = p_project_id AND lower(wallet_address) = lower(p_target) FOR UPDATE;

    -- DETERMINISTIC STATE MACHINE
    IF p_action = 'invite' THEN
        IF lower(p_actor) != v_founder_wallet THEN RAISE EXCEPTION 'Only founder can invite.'; END IF;
        IF v_current_status IN ('pending_invite', 'pending_application', 'active') THEN RAISE EXCEPTION 'User already has active/pending status.'; END IF;
        v_new_status := 'pending_invite';
    ELSIF p_action = 'apply' THEN
        IF lower(p_actor) != lower(p_target) THEN RAISE EXCEPTION 'Apply for yourself only.'; END IF;
        IF v_current_status IN ('pending_invite', 'pending_application', 'active') THEN RAISE EXCEPTION 'User already has active/pending status.'; END IF;
        v_new_status := 'pending_application';
    ELSIF p_action = 'approve_app' THEN
        IF lower(p_actor) != v_founder_wallet THEN RAISE EXCEPTION 'Only founder can approve.'; END IF;
        IF v_current_status != 'pending_application' THEN RAISE EXCEPTION 'Invalid transition.'; END IF;
        v_new_status := 'active';
    ELSIF p_action = 'reject_app' THEN
        IF lower(p_actor) != v_founder_wallet THEN RAISE EXCEPTION 'Only founder can reject.'; END IF;
        IF v_current_status != 'pending_application' THEN RAISE EXCEPTION 'Invalid transition.'; END IF;
        v_new_status := 'rejected';
    ELSIF p_action = 'accept_invite' THEN
        IF lower(p_actor) != lower(p_target) THEN RAISE EXCEPTION 'Only invitee can accept.'; END IF;
        IF v_current_status != 'pending_invite' THEN RAISE EXCEPTION 'Invalid transition.'; END IF;
        v_new_status := 'active';
    ELSIF p_action = 'reject_invite' THEN
        IF lower(p_actor) != lower(p_target) THEN RAISE EXCEPTION 'Only invitee can reject.'; END IF;
        IF v_current_status != 'pending_invite' THEN RAISE EXCEPTION 'Invalid transition.'; END IF;
        v_new_status := 'rejected';
    ELSIF p_action = 'revoke_invite' THEN
        IF lower(p_actor) != v_founder_wallet THEN RAISE EXCEPTION 'Only founder can revoke.'; END IF;
        IF v_current_status != 'pending_invite' THEN RAISE EXCEPTION 'Invalid transition.'; END IF;
        v_new_status := 'revoked';
    ELSIF p_action = 'kick' THEN
        IF lower(p_actor) != v_founder_wallet THEN RAISE EXCEPTION 'Only founder can kick.'; END IF;
        IF v_current_status != 'active' THEN RAISE EXCEPTION 'User is not active.'; END IF;
        v_new_status := 'kicked';
    ELSIF p_action = 'leave' THEN
        IF lower(p_actor) != lower(p_target) THEN RAISE EXCEPTION 'Only user can leave.'; END IF;
        IF v_current_status != 'active' THEN RAISE EXCEPTION 'User is not active.'; END IF;
        v_new_status := 'left';
    ELSE
        RAISE EXCEPTION 'Unknown action.';
    END IF;

    -- EVENT LOG INSERT
    INSERT INTO public.squad_transition_logs (project_id, actor_wallet, target_wallet, action_type, role, nonce, signature_hash, created_at) 
    VALUES (p_project_id, lower(p_actor), lower(p_target), p_action, p_role, p_nonce, p_signature, v_now) 
    RETURNING sequence_number INTO v_inserted_sequence;

    -- PROJECTION UPDATE
    IF v_member_id IS NULL THEN
        INSERT INTO public.squad_members (project_id, wallet_address, role, status, updated_at, joined_at) 
        VALUES (p_project_id, lower(p_target), p_role, v_new_status, v_now, CASE WHEN v_new_status = 'active' THEN v_now ELSE NULL END);
    ELSE
        UPDATE public.squad_members SET 
            status = v_new_status, role = p_role, updated_at = v_now,
            joined_at = CASE WHEN v_new_status = 'active' AND v_joined_at IS NULL THEN v_now ELSE v_joined_at END,
            left_at = CASE WHEN v_new_status IN ('kicked', 'left') AND v_left_at IS NULL THEN v_now ELSE v_left_at END
        WHERE id = v_member_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Protocol action executed.', 'new_status', v_new_status, 'sequence', v_inserted_sequence);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Protocol execution failed due to an internal rule violation.');
END;$function$
;

CREATE OR REPLACE FUNCTION public.process_squad_transition(p_project_id uuid, p_actor text, p_target text, p_action text, p_role text, p_nonce text, p_signature text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_project RECORD;
    v_active_member_count INT;
BEGIN
    -- 1. Nonce tüketimi (Replay Attack Koruması)
    -- İşlem başlar başlamaz nonce'u siliyoruz. Eğer silinecek satır yoksa işlem reddedilir.
    DELETE FROM public.auth_nonces 
    WHERE nonce = p_nonce AND wallet_address = p_actor;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired nonce. Replay attack prevented.');
    END IF;

    -- 2. Projeyi bul
    SELECT * INTO v_project FROM public.squad_projects WHERE id = p_project_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Project not found.');
    END IF;

    -- =========================================================================
    -- 🔥 YENİ ZIRH: Maksimum Takım Kapasitesi Kontrolü (Sadece Invite ve Approve işlemlerinde)
    -- =========================================================================
    IF p_action IN ('invite', 'approve_app') THEN
        -- Projedeki aktif (veya onayı bekleyen invite) üye sayısını say
        SELECT COUNT(*) INTO v_active_member_count 
        FROM public.squad_members 
        WHERE project_id = p_project_id AND status IN ('active', 'pending_invite');

        -- Kurucu(Founder) da dahil edileceği için limiti 7 olarak belirliyoruz
        IF v_active_member_count >= 7 THEN
            RETURN jsonb_build_object('success', false, 'message', 'Squad capacity reached (Max 7 members).');
        END IF;
    END IF;

    -- 3. Yetki Kontrolleri (Mevcut mantığının devamı)
    -- Burada senin mevcut fonksiyonunun geri kalanı olmalı.
    -- (Eğer fonksiyonun tamamı sendeyse, bu IF bloğunu kendi fonksiyonunun içine yerleştirebilirsin).
    
    RETURN jsonb_build_object('success', true, 'message', 'Transition logged successfully.');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_squad_transition_v2(p_project_id uuid, p_actor text, p_target text, p_action public.squad_action_t, p_nonce text, p_signature text, p_timestamp bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$DECLARE
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

  -- ── 2. Resolve actor membership ────────────────────────────────────────
  SELECT * INTO v_actor_member
  FROM squad_members
  WHERE project_id = p_project_id
    AND user_id = (
      SELECT id FROM profiles  WHERE wallet_address = p_actor LIMIT 1
    )
    AND status = 'active'
  LIMIT 1;

  -- ── 3. Resolve target membership ──────────────────────────────────────
  SELECT * INTO v_target_member
  FROM squad_members
  WHERE project_id = p_project_id
    AND user_id = (
      SELECT id FROM users WHERE wallet_address = p_target LIMIT 1
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
END;$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_project_trust(p_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
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
  -- KRİTİK DÜZELTME: created_by_wallet (text) yerine created_by (uuid) alıyoruz
  SELECT created_by INTO v_founder_id 
  FROM squad_projects 
  WHERE id = p_project_id;

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
$function$
;

CREATE OR REPLACE FUNCTION public.release_lock(p_key text, p_worker_id text)
 RETURNS void
 LANGUAGE sql
AS $function$
  delete from public.snapshot_locks
  where lock_key = p_key and worker_id = p_worker_id;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_squad_member_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM recalculate_project_trust(NEW.project_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM recalculate_project_trust(OLD.project_id);
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_trust_score_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$DECLARE
  v_proj RECORD;
BEGIN
  IF NEW.dev_score = OLD.dev_score AND NEW.tier = OLD.tier THEN
    RETURN NEW;
  END IF;

  FOR v_proj IN SELECT id FROM squad_projects WHERE created_by_wallet = NEW.user_id LOOP
    PERFORM recalculate_project_trust(v_proj.id);
  END LOOP;

  FOR v_proj IN SELECT DISTINCT project_id FROM squad_members WHERE user_id = NEW.user_id AND status = 'active' LOOP
    PERFORM recalculate_project_trust(v_proj.project_id);
  END LOOP;

  RETURN NEW;
END;$function$
;

CREATE OR REPLACE FUNCTION public.update_trust_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = timezone('utc'::text, now()); RETURN NEW; END; $function$
;


