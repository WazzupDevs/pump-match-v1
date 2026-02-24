create extension if not exists "pg_cron" with schema "pg_catalog";

drop extension if exists "pg_net";

create type "public"."squad_action_t" as enum ('invite', 'apply', 'approve_app', 'reject_app', 'accept_invite', 'reject_invite', 'revoke_invite', 'kick', 'leave');

create type "public"."squad_status_t" as enum ('pending_invite', 'pending_application', 'active', 'rejected', 'revoked', 'kicked', 'left');

create sequence "public"."slashing_appeals_id_seq";

create sequence "public"."slashing_logs_id_seq";

create sequence "public"."squad_transition_logs_sequence_number_seq";


  create table "public"."auth_nonces" (
    "nonce" text not null,
    "wallet_address" text not null,
    "action" text not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."auth_nonces" enable row level security;


  create table "public"."matches" (
    "id" uuid not null default gen_random_uuid(),
    "user_one" text not null,
    "user_two" text not null,
    "compatibility_score" integer,
    "shared_interests" text[],
    "created_at" timestamp with time zone default now()
      );



  create table "public"."processed_events" (
    "tx_hash" text not null,
    "event_type" text not null,
    "processed_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."processed_events" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "role" text,
    "bio" text,
    "x_handle" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."profiles" enable row level security;


  create table "public"."project_owners" (
    "token_address" text not null,
    "owner_user_id" uuid not null,
    "role" text not null default 'creator'::text,
    "is_active" boolean not null default true,
    "assigned_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "revoked_at" timestamp with time zone
      );


alter table "public"."project_owners" enable row level security;


  create table "public"."slashing_appeals" (
    "id" bigint not null default nextval('public.slashing_appeals_id_seq'::regclass),
    "user_id" uuid not null,
    "slashing_log_id" bigint not null,
    "status" text not null default 'pending'::text,
    "reviewed_by" uuid,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."slashing_appeals" enable row level security;


  create table "public"."slashing_logs" (
    "id" bigint not null default nextval('public.slashing_logs_id_seq'::regclass),
    "user_id" uuid not null,
    "reason" text not null,
    "tx_hash" text not null,
    "stake_slashed" boolean not null default false,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."slashing_logs" enable row level security;


  create table "public"."snapshot_locks" (
    "lock_key" text not null,
    "locked_at" timestamp with time zone not null,
    "worker_id" text
      );


alter table "public"."snapshot_locks" enable row level security;


  create table "public"."squad_members" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "user_id" uuid not null,
    "role" text not null default 'member'::text,
    "status" text not null default 'active'::text,
    "joined_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "left_at" timestamp with time zone
      );


alter table "public"."squad_members" enable row level security;


  create table "public"."squad_projects" (
    "id" uuid not null default gen_random_uuid(),
    "project_name" text not null,
    "mint_address" text not null,
    "team_members" text[],
    "market_cap" numeric default 0,
    "last_valid_mc" numeric default 0,
    "liquidity_usd" numeric default 0,
    "volume_24h" numeric default 0,
    "status" text default 'active'::text,
    "last_mc_update" timestamp with time zone default now(),
    "created_by" text not null,
    "created_at" timestamp with time zone default now(),
    "claim_tier" text default 'founder'::text,
    "is_renounced" boolean default false,
    "update_authority" text,
    "created_by_wallet" text,
    "one_hour_change" numeric default 0,
    "project_symbol" text default 'Sym'::text,
    "project_trust_score" integer default 0,
    "project_risk_band" text default 'EXTREME'::text
      );


alter table "public"."squad_projects" enable row level security;


  create table "public"."squad_transition_logs" (
    "sequence_number" bigint not null default nextval('public.squad_transition_logs_sequence_number_seq'::regclass),
    "protocol_version" smallint not null default 1,
    "project_id" uuid not null,
    "actor_wallet" character varying(64) not null,
    "target_wallet" character varying(64) not null,
    "action_type" character varying(50) not null,
    "role" character varying(50) not null,
    "nonce" uuid not null,
    "signature_hash" character varying(255) not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."squad_transition_logs" enable row level security;


  create table "public"."trust_metrics" (
    "user_id" uuid not null,
    "dev_score" integer not null default 0,
    "marketer_score" integer not null default 0,
    "designer_score" integer not null default 0,
    "composite_score" integer not null default 0,
    "tier" text not null default 'Newbie'::text,
    "consecutive_growth_epochs" integer not null default 0,
    "last_active_at" timestamp with time zone default timezone('utc'::text, now()),
    "last_calculated_at" timestamp with time zone,
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."trust_metrics" enable row level security;


  create table "public"."users" (
    "id" uuid not null default gen_random_uuid(),
    "wallet_address" text not null,
    "username" text,
    "trust_score" integer default 0,
    "level" text default 'Rookie'::text,
    "active_badges" jsonb default '[]'::jsonb,
    "social_proof" jsonb default '{}'::jsonb,
    "match_filters" jsonb default '{}'::jsonb,
    "cached_matches" jsonb default '[]'::jsonb,
    "intent" text,
    "identity_state" text default 'GHOST'::text,
    "match_count" integer default 0,
    "last_active_at" bigint,
    "last_match_snapshot_at" bigint,
    "joined_at" bigint default (EXTRACT(epoch FROM now()) * (1000)::numeric),
    "created_at" timestamp with time zone default now(),
    "is_opted_in" boolean default false
      );


alter sequence "public"."slashing_appeals_id_seq" owned by "public"."slashing_appeals"."id";

alter sequence "public"."slashing_logs_id_seq" owned by "public"."slashing_logs"."id";

alter sequence "public"."squad_transition_logs_sequence_number_seq" owned by "public"."squad_transition_logs"."sequence_number";

CREATE UNIQUE INDEX auth_nonces_pkey ON public.auth_nonces USING btree (nonce);

CREATE UNIQUE INDEX auth_nonces_wallet_nonce_key ON public.auth_nonces USING btree (wallet_address, nonce);

CREATE INDEX idx_auth_nonces_created_at ON public.auth_nonces USING btree (created_at);

CREATE INDEX idx_auth_nonces_wallet ON public.auth_nonces USING btree (wallet_address);

CREATE INDEX idx_squad_projects_mc ON public.squad_projects USING btree (market_cap DESC);

CREATE INDEX idx_squad_projects_status ON public.squad_projects USING btree (status);

CREATE UNIQUE INDEX matches_pkey ON public.matches USING btree (id);

CREATE UNIQUE INDEX processed_events_pkey ON public.processed_events USING btree (tx_hash, event_type);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX project_owners_pkey ON public.project_owners USING btree (token_address, owner_user_id);

CREATE UNIQUE INDEX slashing_appeals_pkey ON public.slashing_appeals USING btree (id);

CREATE UNIQUE INDEX slashing_logs_pkey ON public.slashing_logs USING btree (id);

CREATE UNIQUE INDEX snapshot_locks_pkey ON public.snapshot_locks USING btree (lock_key);

CREATE UNIQUE INDEX squad_members_pkey ON public.squad_members USING btree (id);

CREATE UNIQUE INDEX squad_members_project_id_user_id_key ON public.squad_members USING btree (project_id, user_id);

CREATE UNIQUE INDEX squad_projects_mint_address_key ON public.squad_projects USING btree (mint_address);

CREATE UNIQUE INDEX squad_projects_pkey ON public.squad_projects USING btree (id);

CREATE UNIQUE INDEX squad_transition_logs_pkey ON public.squad_transition_logs USING btree (sequence_number);

CREATE UNIQUE INDEX trust_metrics_pkey ON public.trust_metrics USING btree (user_id);

CREATE UNIQUE INDEX unique_mint_address ON public.squad_projects USING btree (mint_address);

CREATE UNIQUE INDEX unique_project_actor_nonce ON public.squad_transition_logs USING btree (project_id, actor_wallet, nonce);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE UNIQUE INDEX users_wallet_address_key ON public.users USING btree (wallet_address);

alter table "public"."auth_nonces" add constraint "auth_nonces_pkey" PRIMARY KEY using index "auth_nonces_pkey";

alter table "public"."matches" add constraint "matches_pkey" PRIMARY KEY using index "matches_pkey";

alter table "public"."processed_events" add constraint "processed_events_pkey" PRIMARY KEY using index "processed_events_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."project_owners" add constraint "project_owners_pkey" PRIMARY KEY using index "project_owners_pkey";

alter table "public"."slashing_appeals" add constraint "slashing_appeals_pkey" PRIMARY KEY using index "slashing_appeals_pkey";

alter table "public"."slashing_logs" add constraint "slashing_logs_pkey" PRIMARY KEY using index "slashing_logs_pkey";

alter table "public"."snapshot_locks" add constraint "snapshot_locks_pkey" PRIMARY KEY using index "snapshot_locks_pkey";

alter table "public"."squad_members" add constraint "squad_members_pkey" PRIMARY KEY using index "squad_members_pkey";

alter table "public"."squad_projects" add constraint "squad_projects_pkey" PRIMARY KEY using index "squad_projects_pkey";

alter table "public"."squad_transition_logs" add constraint "squad_transition_logs_pkey" PRIMARY KEY using index "squad_transition_logs_pkey";

alter table "public"."trust_metrics" add constraint "trust_metrics_pkey" PRIMARY KEY using index "trust_metrics_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."auth_nonces" add constraint "auth_nonces_wallet_nonce_key" UNIQUE using index "auth_nonces_wallet_nonce_key";

alter table "public"."matches" add constraint "matches_user_one_fkey" FOREIGN KEY (user_one) REFERENCES public.users(wallet_address) not valid;

alter table "public"."matches" validate constraint "matches_user_one_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."project_owners" add constraint "project_owners_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."project_owners" validate constraint "project_owners_owner_user_id_fkey";

alter table "public"."slashing_appeals" add constraint "slashing_appeals_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) not valid;

alter table "public"."slashing_appeals" validate constraint "slashing_appeals_reviewed_by_fkey";

alter table "public"."slashing_appeals" add constraint "slashing_appeals_slashing_log_id_fkey" FOREIGN KEY (slashing_log_id) REFERENCES public.slashing_logs(id) ON DELETE CASCADE not valid;

alter table "public"."slashing_appeals" validate constraint "slashing_appeals_slashing_log_id_fkey";

alter table "public"."slashing_appeals" add constraint "slashing_appeals_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."slashing_appeals" validate constraint "slashing_appeals_status_check";

alter table "public"."slashing_appeals" add constraint "slashing_appeals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."slashing_appeals" validate constraint "slashing_appeals_user_id_fkey";

alter table "public"."slashing_logs" add constraint "slashing_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."slashing_logs" validate constraint "slashing_logs_user_id_fkey";

alter table "public"."squad_members" add constraint "squad_members_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.squad_projects(id) ON DELETE CASCADE not valid;

alter table "public"."squad_members" validate constraint "squad_members_project_id_fkey";

alter table "public"."squad_members" add constraint "squad_members_project_id_user_id_key" UNIQUE using index "squad_members_project_id_user_id_key";

alter table "public"."squad_members" add constraint "squad_members_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'left'::text]))) not valid;

alter table "public"."squad_members" validate constraint "squad_members_status_check";

alter table "public"."squad_members" add constraint "squad_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."squad_members" validate constraint "squad_members_user_id_fkey";

alter table "public"."squad_projects" add constraint "squad_projects_mint_address_key" UNIQUE using index "squad_projects_mint_address_key";

alter table "public"."squad_projects" add constraint "unique_mint_address" UNIQUE using index "unique_mint_address";

alter table "public"."squad_transition_logs" add constraint "squad_transition_logs_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.squad_projects(id) ON DELETE CASCADE not valid;

alter table "public"."squad_transition_logs" validate constraint "squad_transition_logs_project_id_fkey";

alter table "public"."squad_transition_logs" add constraint "unique_project_actor_nonce" UNIQUE using index "unique_project_actor_nonce";

alter table "public"."trust_metrics" add constraint "trust_metrics_composite_score_check" CHECK (((composite_score >= 0) AND (composite_score <= 1000))) not valid;

alter table "public"."trust_metrics" validate constraint "trust_metrics_composite_score_check";

alter table "public"."trust_metrics" add constraint "trust_metrics_designer_score_check" CHECK (((designer_score >= 0) AND (designer_score <= 1000))) not valid;

alter table "public"."trust_metrics" validate constraint "trust_metrics_designer_score_check";

alter table "public"."trust_metrics" add constraint "trust_metrics_dev_score_check" CHECK (((dev_score >= 0) AND (dev_score <= 1000))) not valid;

alter table "public"."trust_metrics" validate constraint "trust_metrics_dev_score_check";

alter table "public"."trust_metrics" add constraint "trust_metrics_marketer_score_check" CHECK (((marketer_score >= 0) AND (marketer_score <= 1000))) not valid;

alter table "public"."trust_metrics" validate constraint "trust_metrics_marketer_score_check";

alter table "public"."trust_metrics" add constraint "trust_metrics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."trust_metrics" validate constraint "trust_metrics_user_id_fkey";

alter table "public"."users" add constraint "users_wallet_address_key" UNIQUE using index "users_wallet_address_key";

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

CREATE OR REPLACE FUNCTION public.process_squad_transition(p_project_id uuid, p_actor character varying, p_target character varying, p_action character varying, p_role character varying, p_nonce uuid, p_signature character varying)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_founder_wallet VARCHAR(64);
    v_current_status VARCHAR(50);
    v_new_status VARCHAR(50);
    v_now TIMESTAMPTZ := NOW(); -- Deterministic DB timestamp
    v_inserted_sequence BIGINT;
    v_member_record RECORD;
BEGIN
    -- 1. DEADLOCK PREVENTION: Strict Locking Order (Project -> Member)
    -- Lock the project to ensure no parallel actions mutate squad state concurrently.
    SELECT lower(claimed_by) INTO v_founder_wallet 
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
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_squad_transition(p_project_id uuid, p_actor character varying, p_target character varying, p_action public.squad_action_t, p_role character varying, p_nonce uuid, p_signature character varying)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
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
  -- 1. Kurucuyu (Founder) ve Puanını Bul
  SELECT claimed_by INTO v_founder_id 
  FROM squad_projects 
  WHERE id = p_project_id;

  IF v_founder_id IS NOT NULL THEN
    SELECT dev_score, tier INTO v_founder_score, v_founder_status 
    FROM trust_metrics 
    WHERE user_id = v_founder_id;
    
    -- GÜVENLİK: Eğer kurucu EXILED (Sürgün) ise, proje tartışmasız RUGGED olur.
    IF v_founder_status = 'EXILED' THEN
      UPDATE squad_projects 
      SET project_trust_score = 0, project_risk_band = 'RUGGED'
      WHERE id = p_project_id;
      RETURN;
    END IF;
  END IF;

  IF v_founder_score IS NULL THEN v_founder_score := 0; END IF;

  -- 2. Takım Ortalamasını (Squad Average) Hesapla 
  SELECT COALESCE(AVG(tm.dev_score), 0), COUNT(sm.id)
  INTO v_squad_avg_score, v_squad_member_count
  FROM squad_members sm
  JOIN trust_metrics tm ON tm.user_id = sm.user_id
  WHERE sm.project_id = p_project_id AND sm.status = 'active';

  -- 3. 60/40 Hibrit Algoritması
  IF v_squad_member_count = 0 THEN
    v_final_score := v_founder_score;
  ELSE
    v_final_score := ROUND((v_founder_score * 0.6) + (v_squad_avg_score * 0.4));
  END IF;

  -- 4. Risk Bandı (Web3 Moody's Rating)
  IF v_final_score >= 800 THEN v_risk_band := 'SAFE';
  ELSIF v_final_score >= 600 THEN v_risk_band := 'LOW_RISK';
  ELSIF v_final_score >= 400 THEN v_risk_band := 'MEDIUM';
  ELSIF v_final_score >= 200 THEN v_risk_band := 'HIGH';
  ELSE v_risk_band := 'EXTREME';
  END IF;

  -- 5. Sonucu Cache'le
  UPDATE squad_projects 
  SET 
    project_trust_score = v_final_score, 
    project_risk_band = v_risk_band
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

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
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
AS $function$
DECLARE
  v_proj RECORD;
BEGIN
  IF NEW.dev_score = OLD.dev_score AND NEW.tier = OLD.tier THEN
    RETURN NEW;
  END IF;

  FOR v_proj IN SELECT id FROM squad_projects WHERE claimed_by = NEW.user_id LOOP
    PERFORM recalculate_project_trust(v_proj.id);
  END LOOP;

  FOR v_proj IN SELECT DISTINCT project_id FROM squad_members WHERE user_id = NEW.user_id AND status = 'active' LOOP
    PERFORM recalculate_project_trust(v_proj.project_id);
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_trust_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = timezone('utc'::text, now()); RETURN NEW; END; $function$
;

grant delete on table "public"."auth_nonces" to "anon";

grant insert on table "public"."auth_nonces" to "anon";

grant references on table "public"."auth_nonces" to "anon";

grant select on table "public"."auth_nonces" to "anon";

grant trigger on table "public"."auth_nonces" to "anon";

grant truncate on table "public"."auth_nonces" to "anon";

grant update on table "public"."auth_nonces" to "anon";

grant delete on table "public"."auth_nonces" to "authenticated";

grant insert on table "public"."auth_nonces" to "authenticated";

grant references on table "public"."auth_nonces" to "authenticated";

grant select on table "public"."auth_nonces" to "authenticated";

grant trigger on table "public"."auth_nonces" to "authenticated";

grant truncate on table "public"."auth_nonces" to "authenticated";

grant update on table "public"."auth_nonces" to "authenticated";

grant delete on table "public"."auth_nonces" to "service_role";

grant insert on table "public"."auth_nonces" to "service_role";

grant references on table "public"."auth_nonces" to "service_role";

grant select on table "public"."auth_nonces" to "service_role";

grant trigger on table "public"."auth_nonces" to "service_role";

grant truncate on table "public"."auth_nonces" to "service_role";

grant update on table "public"."auth_nonces" to "service_role";

grant delete on table "public"."matches" to "anon";

grant insert on table "public"."matches" to "anon";

grant references on table "public"."matches" to "anon";

grant select on table "public"."matches" to "anon";

grant trigger on table "public"."matches" to "anon";

grant truncate on table "public"."matches" to "anon";

grant update on table "public"."matches" to "anon";

grant delete on table "public"."matches" to "authenticated";

grant insert on table "public"."matches" to "authenticated";

grant references on table "public"."matches" to "authenticated";

grant select on table "public"."matches" to "authenticated";

grant trigger on table "public"."matches" to "authenticated";

grant truncate on table "public"."matches" to "authenticated";

grant update on table "public"."matches" to "authenticated";

grant delete on table "public"."matches" to "service_role";

grant insert on table "public"."matches" to "service_role";

grant references on table "public"."matches" to "service_role";

grant select on table "public"."matches" to "service_role";

grant trigger on table "public"."matches" to "service_role";

grant truncate on table "public"."matches" to "service_role";

grant update on table "public"."matches" to "service_role";

grant delete on table "public"."processed_events" to "anon";

grant insert on table "public"."processed_events" to "anon";

grant references on table "public"."processed_events" to "anon";

grant select on table "public"."processed_events" to "anon";

grant trigger on table "public"."processed_events" to "anon";

grant truncate on table "public"."processed_events" to "anon";

grant update on table "public"."processed_events" to "anon";

grant delete on table "public"."processed_events" to "authenticated";

grant insert on table "public"."processed_events" to "authenticated";

grant references on table "public"."processed_events" to "authenticated";

grant select on table "public"."processed_events" to "authenticated";

grant trigger on table "public"."processed_events" to "authenticated";

grant truncate on table "public"."processed_events" to "authenticated";

grant update on table "public"."processed_events" to "authenticated";

grant delete on table "public"."processed_events" to "service_role";

grant insert on table "public"."processed_events" to "service_role";

grant references on table "public"."processed_events" to "service_role";

grant select on table "public"."processed_events" to "service_role";

grant trigger on table "public"."processed_events" to "service_role";

grant truncate on table "public"."processed_events" to "service_role";

grant update on table "public"."processed_events" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."project_owners" to "anon";

grant insert on table "public"."project_owners" to "anon";

grant references on table "public"."project_owners" to "anon";

grant select on table "public"."project_owners" to "anon";

grant trigger on table "public"."project_owners" to "anon";

grant truncate on table "public"."project_owners" to "anon";

grant update on table "public"."project_owners" to "anon";

grant delete on table "public"."project_owners" to "authenticated";

grant insert on table "public"."project_owners" to "authenticated";

grant references on table "public"."project_owners" to "authenticated";

grant select on table "public"."project_owners" to "authenticated";

grant trigger on table "public"."project_owners" to "authenticated";

grant truncate on table "public"."project_owners" to "authenticated";

grant update on table "public"."project_owners" to "authenticated";

grant delete on table "public"."project_owners" to "service_role";

grant insert on table "public"."project_owners" to "service_role";

grant references on table "public"."project_owners" to "service_role";

grant select on table "public"."project_owners" to "service_role";

grant trigger on table "public"."project_owners" to "service_role";

grant truncate on table "public"."project_owners" to "service_role";

grant update on table "public"."project_owners" to "service_role";

grant delete on table "public"."slashing_appeals" to "anon";

grant insert on table "public"."slashing_appeals" to "anon";

grant references on table "public"."slashing_appeals" to "anon";

grant select on table "public"."slashing_appeals" to "anon";

grant trigger on table "public"."slashing_appeals" to "anon";

grant truncate on table "public"."slashing_appeals" to "anon";

grant update on table "public"."slashing_appeals" to "anon";

grant delete on table "public"."slashing_appeals" to "authenticated";

grant insert on table "public"."slashing_appeals" to "authenticated";

grant references on table "public"."slashing_appeals" to "authenticated";

grant select on table "public"."slashing_appeals" to "authenticated";

grant trigger on table "public"."slashing_appeals" to "authenticated";

grant truncate on table "public"."slashing_appeals" to "authenticated";

grant update on table "public"."slashing_appeals" to "authenticated";

grant delete on table "public"."slashing_appeals" to "service_role";

grant insert on table "public"."slashing_appeals" to "service_role";

grant references on table "public"."slashing_appeals" to "service_role";

grant select on table "public"."slashing_appeals" to "service_role";

grant trigger on table "public"."slashing_appeals" to "service_role";

grant truncate on table "public"."slashing_appeals" to "service_role";

grant update on table "public"."slashing_appeals" to "service_role";

grant delete on table "public"."slashing_logs" to "anon";

grant insert on table "public"."slashing_logs" to "anon";

grant references on table "public"."slashing_logs" to "anon";

grant select on table "public"."slashing_logs" to "anon";

grant trigger on table "public"."slashing_logs" to "anon";

grant truncate on table "public"."slashing_logs" to "anon";

grant update on table "public"."slashing_logs" to "anon";

grant delete on table "public"."slashing_logs" to "authenticated";

grant insert on table "public"."slashing_logs" to "authenticated";

grant references on table "public"."slashing_logs" to "authenticated";

grant select on table "public"."slashing_logs" to "authenticated";

grant trigger on table "public"."slashing_logs" to "authenticated";

grant truncate on table "public"."slashing_logs" to "authenticated";

grant update on table "public"."slashing_logs" to "authenticated";

grant delete on table "public"."slashing_logs" to "service_role";

grant insert on table "public"."slashing_logs" to "service_role";

grant references on table "public"."slashing_logs" to "service_role";

grant select on table "public"."slashing_logs" to "service_role";

grant trigger on table "public"."slashing_logs" to "service_role";

grant truncate on table "public"."slashing_logs" to "service_role";

grant update on table "public"."slashing_logs" to "service_role";

grant delete on table "public"."snapshot_locks" to "anon";

grant insert on table "public"."snapshot_locks" to "anon";

grant references on table "public"."snapshot_locks" to "anon";

grant select on table "public"."snapshot_locks" to "anon";

grant trigger on table "public"."snapshot_locks" to "anon";

grant truncate on table "public"."snapshot_locks" to "anon";

grant update on table "public"."snapshot_locks" to "anon";

grant delete on table "public"."snapshot_locks" to "authenticated";

grant insert on table "public"."snapshot_locks" to "authenticated";

grant references on table "public"."snapshot_locks" to "authenticated";

grant select on table "public"."snapshot_locks" to "authenticated";

grant trigger on table "public"."snapshot_locks" to "authenticated";

grant truncate on table "public"."snapshot_locks" to "authenticated";

grant update on table "public"."snapshot_locks" to "authenticated";

grant delete on table "public"."snapshot_locks" to "service_role";

grant insert on table "public"."snapshot_locks" to "service_role";

grant references on table "public"."snapshot_locks" to "service_role";

grant select on table "public"."snapshot_locks" to "service_role";

grant trigger on table "public"."snapshot_locks" to "service_role";

grant truncate on table "public"."snapshot_locks" to "service_role";

grant update on table "public"."snapshot_locks" to "service_role";

grant delete on table "public"."squad_members" to "anon";

grant insert on table "public"."squad_members" to "anon";

grant references on table "public"."squad_members" to "anon";

grant select on table "public"."squad_members" to "anon";

grant trigger on table "public"."squad_members" to "anon";

grant truncate on table "public"."squad_members" to "anon";

grant update on table "public"."squad_members" to "anon";

grant delete on table "public"."squad_members" to "authenticated";

grant insert on table "public"."squad_members" to "authenticated";

grant references on table "public"."squad_members" to "authenticated";

grant select on table "public"."squad_members" to "authenticated";

grant trigger on table "public"."squad_members" to "authenticated";

grant truncate on table "public"."squad_members" to "authenticated";

grant update on table "public"."squad_members" to "authenticated";

grant delete on table "public"."squad_members" to "service_role";

grant insert on table "public"."squad_members" to "service_role";

grant references on table "public"."squad_members" to "service_role";

grant select on table "public"."squad_members" to "service_role";

grant trigger on table "public"."squad_members" to "service_role";

grant truncate on table "public"."squad_members" to "service_role";

grant update on table "public"."squad_members" to "service_role";

grant delete on table "public"."squad_projects" to "anon";

grant insert on table "public"."squad_projects" to "anon";

grant references on table "public"."squad_projects" to "anon";

grant select on table "public"."squad_projects" to "anon";

grant trigger on table "public"."squad_projects" to "anon";

grant truncate on table "public"."squad_projects" to "anon";

grant update on table "public"."squad_projects" to "anon";

grant delete on table "public"."squad_projects" to "authenticated";

grant insert on table "public"."squad_projects" to "authenticated";

grant references on table "public"."squad_projects" to "authenticated";

grant select on table "public"."squad_projects" to "authenticated";

grant trigger on table "public"."squad_projects" to "authenticated";

grant truncate on table "public"."squad_projects" to "authenticated";

grant update on table "public"."squad_projects" to "authenticated";

grant delete on table "public"."squad_projects" to "service_role";

grant insert on table "public"."squad_projects" to "service_role";

grant references on table "public"."squad_projects" to "service_role";

grant select on table "public"."squad_projects" to "service_role";

grant trigger on table "public"."squad_projects" to "service_role";

grant truncate on table "public"."squad_projects" to "service_role";

grant update on table "public"."squad_projects" to "service_role";

grant delete on table "public"."squad_transition_logs" to "anon";

grant insert on table "public"."squad_transition_logs" to "anon";

grant references on table "public"."squad_transition_logs" to "anon";

grant select on table "public"."squad_transition_logs" to "anon";

grant trigger on table "public"."squad_transition_logs" to "anon";

grant truncate on table "public"."squad_transition_logs" to "anon";

grant update on table "public"."squad_transition_logs" to "anon";

grant delete on table "public"."squad_transition_logs" to "authenticated";

grant insert on table "public"."squad_transition_logs" to "authenticated";

grant references on table "public"."squad_transition_logs" to "authenticated";

grant select on table "public"."squad_transition_logs" to "authenticated";

grant trigger on table "public"."squad_transition_logs" to "authenticated";

grant truncate on table "public"."squad_transition_logs" to "authenticated";

grant update on table "public"."squad_transition_logs" to "authenticated";

grant delete on table "public"."squad_transition_logs" to "service_role";

grant insert on table "public"."squad_transition_logs" to "service_role";

grant references on table "public"."squad_transition_logs" to "service_role";

grant select on table "public"."squad_transition_logs" to "service_role";

grant trigger on table "public"."squad_transition_logs" to "service_role";

grant truncate on table "public"."squad_transition_logs" to "service_role";

grant update on table "public"."squad_transition_logs" to "service_role";

grant delete on table "public"."trust_metrics" to "anon";

grant insert on table "public"."trust_metrics" to "anon";

grant references on table "public"."trust_metrics" to "anon";

grant select on table "public"."trust_metrics" to "anon";

grant trigger on table "public"."trust_metrics" to "anon";

grant truncate on table "public"."trust_metrics" to "anon";

grant update on table "public"."trust_metrics" to "anon";

grant delete on table "public"."trust_metrics" to "authenticated";

grant insert on table "public"."trust_metrics" to "authenticated";

grant references on table "public"."trust_metrics" to "authenticated";

grant select on table "public"."trust_metrics" to "authenticated";

grant trigger on table "public"."trust_metrics" to "authenticated";

grant truncate on table "public"."trust_metrics" to "authenticated";

grant update on table "public"."trust_metrics" to "authenticated";

grant delete on table "public"."trust_metrics" to "service_role";

grant insert on table "public"."trust_metrics" to "service_role";

grant references on table "public"."trust_metrics" to "service_role";

grant select on table "public"."trust_metrics" to "service_role";

grant trigger on table "public"."trust_metrics" to "service_role";

grant truncate on table "public"."trust_metrics" to "service_role";

grant update on table "public"."trust_metrics" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";


  create policy "Public read profiles"
  on "public"."profiles"
  as permissive
  for select
  to public
using (true);



  create policy "Users can insert own profile"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "Users update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id))
with check ((auth.uid() = id));



  create policy "Enable read access for all users"
  on "public"."squad_projects"
  as permissive
  for select
  to public
using (true);



  create policy "Public read role-aware trust metrics"
  on "public"."trust_metrics"
  as permissive
  for select
  to public
using (true);



  create policy "Enable read/write for all"
  on "public"."users"
  as permissive
  for all
  to anon
using (true)
with check (true);


CREATE TRIGGER tr_create_trust_metrics AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_trust_metrics_for_new_profile();

CREATE TRIGGER tr_squad_member_change AFTER INSERT OR DELETE OR UPDATE ON public.squad_members FOR EACH ROW EXECUTE FUNCTION public.trigger_squad_member_change();

CREATE TRIGGER tr_trust_score_change AFTER UPDATE ON public.trust_metrics FOR EACH ROW EXECUTE FUNCTION public.trigger_trust_score_change();

CREATE TRIGGER tr_update_trust_timestamp BEFORE UPDATE ON public.trust_metrics FOR EACH ROW EXECUTE FUNCTION public.update_trust_timestamp();


