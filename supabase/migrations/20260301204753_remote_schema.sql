
  create table "public"."baseline_epochs" (
    "version" character varying not null,
    "description" text,
    "is_active" boolean default false,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."baseline_epochs" enable row level security;


  create table "public"."engine_versions" (
    "version" character varying not null,
    "git_commit_hash" character varying,
    "description" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."engine_versions" enable row level security;


  create table "public"."reputation_snapshots" (
    "id" uuid not null default gen_random_uuid(),
    "wallet_id" uuid not null,
    "baseline_version" character varying not null,
    "engine_version" character varying not null,
    "archetype" character varying not null,
    "signal_tier" character varying not null,
    "longevity_days" integer,
    "execution_count" integer,
    "pool_diversity" integer,
    "median_holding_duration" integer,
    "analyzed_tx_count" integer not null,
    "proof_hash" character(64) not null,
    "computed_at" timestamp with time zone default now()
      );


alter table "public"."reputation_snapshots" enable row level security;


  create table "public"."wallets" (
    "id" uuid not null default gen_random_uuid(),
    "wallet_address" character varying not null,
    "chain" character varying default 'solana'::character varying,
    "verified_x_handle" character varying,
    "created_at" timestamp with time zone default now(),
    "verified_x_id" character varying,
    "x_verified_at" timestamp with time zone
      );


alter table "public"."wallets" enable row level security;

CREATE UNIQUE INDEX baseline_epochs_pkey ON public.baseline_epochs USING btree (version);

CREATE UNIQUE INDEX engine_versions_pkey ON public.engine_versions USING btree (version);

CREATE INDEX idx_snapshots_latest ON public.reputation_snapshots USING btree (wallet_id, computed_at DESC);

CREATE INDEX idx_snapshots_wallet_id ON public.reputation_snapshots USING btree (wallet_id);

CREATE INDEX idx_wallets_address ON public.wallets USING btree (wallet_address);

CREATE UNIQUE INDEX only_one_active_epoch ON public.baseline_epochs USING btree (is_active) WHERE (is_active = true);

CREATE UNIQUE INDEX reputation_snapshots_pkey ON public.reputation_snapshots USING btree (id);

CREATE UNIQUE INDEX unique_wallet_chain ON public.wallets USING btree (wallet_address, chain);

CREATE UNIQUE INDEX wallets_pkey ON public.wallets USING btree (id);

alter table "public"."baseline_epochs" add constraint "baseline_epochs_pkey" PRIMARY KEY using index "baseline_epochs_pkey";

alter table "public"."engine_versions" add constraint "engine_versions_pkey" PRIMARY KEY using index "engine_versions_pkey";

alter table "public"."reputation_snapshots" add constraint "reputation_snapshots_pkey" PRIMARY KEY using index "reputation_snapshots_pkey";

alter table "public"."wallets" add constraint "wallets_pkey" PRIMARY KEY using index "wallets_pkey";

alter table "public"."reputation_snapshots" add constraint "reputation_snapshots_baseline_version_fkey" FOREIGN KEY (baseline_version) REFERENCES public.baseline_epochs(version) not valid;

alter table "public"."reputation_snapshots" validate constraint "reputation_snapshots_baseline_version_fkey";

alter table "public"."reputation_snapshots" add constraint "reputation_snapshots_engine_version_fkey" FOREIGN KEY (engine_version) REFERENCES public.engine_versions(version) not valid;

alter table "public"."reputation_snapshots" validate constraint "reputation_snapshots_engine_version_fkey";

alter table "public"."reputation_snapshots" add constraint "reputation_snapshots_wallet_id_fkey" FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) not valid;

alter table "public"."reputation_snapshots" validate constraint "reputation_snapshots_wallet_id_fkey";

alter table "public"."wallets" add constraint "unique_wallet_chain" UNIQUE using index "unique_wallet_chain";

grant delete on table "public"."baseline_epochs" to "anon";

grant insert on table "public"."baseline_epochs" to "anon";

grant references on table "public"."baseline_epochs" to "anon";

grant select on table "public"."baseline_epochs" to "anon";

grant trigger on table "public"."baseline_epochs" to "anon";

grant truncate on table "public"."baseline_epochs" to "anon";

grant update on table "public"."baseline_epochs" to "anon";

grant delete on table "public"."baseline_epochs" to "authenticated";

grant insert on table "public"."baseline_epochs" to "authenticated";

grant references on table "public"."baseline_epochs" to "authenticated";

grant select on table "public"."baseline_epochs" to "authenticated";

grant trigger on table "public"."baseline_epochs" to "authenticated";

grant truncate on table "public"."baseline_epochs" to "authenticated";

grant update on table "public"."baseline_epochs" to "authenticated";

grant delete on table "public"."baseline_epochs" to "service_role";

grant insert on table "public"."baseline_epochs" to "service_role";

grant references on table "public"."baseline_epochs" to "service_role";

grant select on table "public"."baseline_epochs" to "service_role";

grant trigger on table "public"."baseline_epochs" to "service_role";

grant truncate on table "public"."baseline_epochs" to "service_role";

grant update on table "public"."baseline_epochs" to "service_role";

grant delete on table "public"."engine_versions" to "anon";

grant insert on table "public"."engine_versions" to "anon";

grant references on table "public"."engine_versions" to "anon";

grant select on table "public"."engine_versions" to "anon";

grant trigger on table "public"."engine_versions" to "anon";

grant truncate on table "public"."engine_versions" to "anon";

grant update on table "public"."engine_versions" to "anon";

grant delete on table "public"."engine_versions" to "authenticated";

grant insert on table "public"."engine_versions" to "authenticated";

grant references on table "public"."engine_versions" to "authenticated";

grant select on table "public"."engine_versions" to "authenticated";

grant trigger on table "public"."engine_versions" to "authenticated";

grant truncate on table "public"."engine_versions" to "authenticated";

grant update on table "public"."engine_versions" to "authenticated";

grant delete on table "public"."engine_versions" to "service_role";

grant insert on table "public"."engine_versions" to "service_role";

grant references on table "public"."engine_versions" to "service_role";

grant select on table "public"."engine_versions" to "service_role";

grant trigger on table "public"."engine_versions" to "service_role";

grant truncate on table "public"."engine_versions" to "service_role";

grant update on table "public"."engine_versions" to "service_role";

grant delete on table "public"."reputation_snapshots" to "anon";

grant insert on table "public"."reputation_snapshots" to "anon";

grant references on table "public"."reputation_snapshots" to "anon";

grant select on table "public"."reputation_snapshots" to "anon";

grant trigger on table "public"."reputation_snapshots" to "anon";

grant truncate on table "public"."reputation_snapshots" to "anon";

grant update on table "public"."reputation_snapshots" to "anon";

grant delete on table "public"."reputation_snapshots" to "authenticated";

grant insert on table "public"."reputation_snapshots" to "authenticated";

grant references on table "public"."reputation_snapshots" to "authenticated";

grant select on table "public"."reputation_snapshots" to "authenticated";

grant trigger on table "public"."reputation_snapshots" to "authenticated";

grant truncate on table "public"."reputation_snapshots" to "authenticated";

grant update on table "public"."reputation_snapshots" to "authenticated";

grant delete on table "public"."reputation_snapshots" to "service_role";

grant insert on table "public"."reputation_snapshots" to "service_role";

grant references on table "public"."reputation_snapshots" to "service_role";

grant select on table "public"."reputation_snapshots" to "service_role";

grant trigger on table "public"."reputation_snapshots" to "service_role";

grant truncate on table "public"."reputation_snapshots" to "service_role";

grant update on table "public"."reputation_snapshots" to "service_role";

grant delete on table "public"."wallets" to "anon";

grant insert on table "public"."wallets" to "anon";

grant references on table "public"."wallets" to "anon";

grant select on table "public"."wallets" to "anon";

grant trigger on table "public"."wallets" to "anon";

grant truncate on table "public"."wallets" to "anon";

grant update on table "public"."wallets" to "anon";

grant delete on table "public"."wallets" to "authenticated";

grant insert on table "public"."wallets" to "authenticated";

grant references on table "public"."wallets" to "authenticated";

grant select on table "public"."wallets" to "authenticated";

grant trigger on table "public"."wallets" to "authenticated";

grant truncate on table "public"."wallets" to "authenticated";

grant update on table "public"."wallets" to "authenticated";

grant delete on table "public"."wallets" to "service_role";

grant insert on table "public"."wallets" to "service_role";

grant references on table "public"."wallets" to "service_role";

grant select on table "public"."wallets" to "service_role";

grant trigger on table "public"."wallets" to "service_role";

grant truncate on table "public"."wallets" to "service_role";

grant update on table "public"."wallets" to "service_role";


