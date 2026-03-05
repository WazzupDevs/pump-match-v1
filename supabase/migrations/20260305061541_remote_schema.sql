alter table "public"."profiles" add column "twitter_linked_at" timestamp with time zone;

alter table "public"."profiles" add column "twitter_user_id" text;

alter table "public"."profiles" add column "verified_x_handle" text;

alter table "public"."profiles" add column "wallet_address" text;

CREATE UNIQUE INDEX profiles_twitter_user_id_uq ON public.profiles USING btree (twitter_user_id) WHERE (twitter_user_id IS NOT NULL);

CREATE INDEX squad_members_project_id_idx ON public.squad_members USING btree (project_id);

CREATE INDEX squad_members_user_id_idx ON public.squad_members USING btree (user_id);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.auth_wallet_address()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'auth', 'public', 'pg_temp'
AS $function$
  SELECT coalesce(
    (SELECT provider_id FROM auth.identities WHERE user_id = auth.uid() AND provider IN ('web3', 'solana') ORDER BY created_at DESC LIMIT 1),
    (SELECT identity_data->>'wallet_address' FROM auth.identities WHERE user_id = auth.uid() AND provider IN ('web3', 'solana') ORDER BY created_at DESC LIMIT 1)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_command_center_projects()
 RETURNS SETOF public.squad_projects
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
  WITH me AS (
    SELECT id, wallet_address AS w
    FROM public.wallets
    WHERE id = auth.uid()
  )
  SELECT sp.*
  FROM public.squad_projects sp
  JOIN me ON true
  WHERE
    sp.created_by_wallet = me.w -- BURAYI DA created_by_wallet YAPTIK!
    OR EXISTS (
      SELECT 1
      FROM public.squad_members sm
      WHERE sm.project_id = sp.id
        AND sm.user_id = me.id
        AND sm.status IN ('active', 'pending_application', 'pending_invite')
    );
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_public_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, wallet_address)
  values (new.id, new.wallet_address)
  on conflict (id) do update
    set wallet_address = excluded.wallet_address;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, wallet_address)
  values (new.id, null)
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_twitter_to_wallet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Eğer sisteme yeni eklenen kimlik (identity) 'twitter' ise:
  IF NEW.provider = 'twitter' THEN
    UPDATE public.wallets
    -- Twitter API'si kullanıcı adını genellikle 'preferred_username' anahtarında döner
    SET verified_x_handle = NEW.identity_data->>'preferred_username'
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$
;


  create policy "squad_members_select_self_or_founder"
  on "public"."squad_members"
  as permissive
  for select
  to authenticated
using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.squad_projects sp
     JOIN public.wallets w ON ((w.id = auth.uid())))
  WHERE ((sp.id = squad_members.project_id) AND (sp.created_by_wallet = (w.wallet_address)::text))))));



  create policy "wallets_select_own"
  on "public"."wallets"
  as permissive
  for select
  to authenticated
using ((id = auth.uid()));


CREATE TRIGGER trg_public_users_create_profile AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_public_user();

CREATE TRIGGER on_twitter_identity_linked AFTER INSERT OR UPDATE ON auth.identities FOR EACH ROW EXECUTE FUNCTION public.sync_twitter_to_wallet();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


