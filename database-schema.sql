
DECLARE
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
    SELECT lower(claimed_by) INTO v_founder_wallet FROM public.squad_projects WHERE id = p_project_id FOR UPDATE;
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
END;

-- 1. AUTH NONCES TABLOSU
CREATE TABLE public.auth_nonces ( 
    wallet_address text NOT NULL, 
    nonce text NOT NULL, 
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), 
    action text NOT NULL 
);

-- 2. SQUAD MEMBERS TABLOSU
CREATE TABLE public.squad_members ( 
    role text NOT NULL DEFAULT 'member'::text, 
    user_id uuid NOT NULL, 
    id uuid NOT NULL DEFAULT gen_random_uuid(), 
    project_id uuid NOT NULL, 
    left_at timestamp with time zone, 
    joined_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), 
    status text NOT NULL DEFAULT 'active'::text 
);

-- 3. SQUAD PROJECTS TABLOSU
CREATE TABLE public.squad_projects ( 
    is_renounced boolean DEFAULT false, 
    mint_address text NOT NULL, 
    team_members text[], 
    market_cap numeric DEFAULT 0, 
    last_valid_mc numeric DEFAULT 0, 
    liquidity_usd numeric DEFAULT 0, 
    volume_24h numeric DEFAULT 0, 
    status text DEFAULT 'active'::text, 
    last_mc_update timestamp with time zone DEFAULT now(), 
    created_by text NOT NULL, 
    created_at timestamp with time zone DEFAULT now(), 
    claim_tier text DEFAULT 'founder'::text, 
    update_authority text, 
    created_by_wallet text, 
    one_hour_change numeric DEFAULT 0, 
    project_symbol text DEFAULT 'Sym'::text, 
    project_trust_score integer DEFAULT 0, 
    project_risk_band text DEFAULT 'EXTREME'::text, 
    id uuid NOT NULL DEFAULT gen_random_uuid(), 
    project_name text NOT NULL 
);

-- 4. USERS TABLOSU
CREATE TABLE public.users ( 
    last_active_at bigint, 
    last_match_snapshot_at bigint, 
    joined_at bigint DEFAULT (EXTRACT(epoch FROM now()) * (1000)::numeric), 
    created_at timestamp with time zone DEFAULT now(), 
    is_opted_in boolean DEFAULT false, 
    match_filters jsonb DEFAULT '{}'::jsonb, 
    id uuid NOT NULL DEFAULT gen_random_uuid(), 
    social_proof jsonb DEFAULT '{}'::jsonb, 
    active_badges jsonb DEFAULT '[]'::jsonb, 
    level text DEFAULT 'Rookie'::text, 
    trust_score integer DEFAULT 0, 
    username text, 
    wallet_address text NOT NULL, 
    match_count integer DEFAULT 0, 
    identity_state text DEFAULT 'GHOST'::text, 
    intent text, 
    cached_matches jsonb DEFAULT '[]'::jsonb 
);