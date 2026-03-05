create or replace function public.bootstrap_user_from_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, wallet_address, is_opted_in, created_at)
  values (new.id, new.wallet_address, false, now())
  on conflict (id) do update
    set wallet_address = excluded.wallet_address;

  insert into public.profiles (id, wallet_address)
  values (new.id, new.wallet_address)
  on conflict (id) do update
    set wallet_address = excluded.wallet_address;

  return new;
end;
$$;

drop trigger if exists trg_wallets_bootstrap_user on public.wallets;

create trigger trg_wallets_bootstrap_user
after insert on public.wallets
for each row
execute function public.bootstrap_user_from_wallet();