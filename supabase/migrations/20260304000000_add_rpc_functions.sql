-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add core RPC functions
-- Date: 2026-03-04
-- Project: PumpMatch
--
-- Adds two functions that were previously deployed directly to the Supabase
-- dashboard and are now tracked in source control:
--
--   1. ensure_wallet_profile()  — called on every login to hydrate the session
--   2. sync_my_twitter_identity() — called after Twitter OAuth to persist data
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ensure_wallet_profile
--
-- Finds or creates the public.wallets row for the currently authenticated user
-- and returns the wallet address.
--
-- The wallet address is extracted from the user's Web3 identity (the Solana
-- identity stored in auth.identities by signInWithWeb3). Multiple field names
-- are checked because supabase-js may store the address under different keys
-- depending on the SDK version.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_wallet_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid         uuid := auth.uid();
  _identity    auth.identities%ROWTYPE;
  _wallet_addr text;
  _wallet_row  public.wallets%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Find the Web3/Solana identity. Exclude known OAuth providers so we always
  -- get the wallet identity regardless of which other providers are linked.
  SELECT * INTO _identity
  FROM auth.identities
  WHERE user_id = _uid
    AND provider NOT IN ('twitter', 'email', 'google', 'github', 'facebook', 'discord')
  ORDER BY created_at ASC -- oldest = the original sign-in identity
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_web3_identity');
  END IF;

  -- supabase-js stores the Solana address in one of these fields depending on
  -- the SDK version (check in priority order).
  _wallet_addr := COALESCE(
    NULLIF(_identity.identity_data ->> 'address',        ''),
    NULLIF(_identity.identity_data ->> 'sub',            ''),
    NULLIF(_identity.identity_data ->> 'wallet_address', '')
  );

  IF _wallet_addr IS NULL THEN
    RETURN jsonb_build_object('error', 'wallet_address_not_found_in_identity');
  END IF;

  -- Upsert: creates the row on first login, no-op on subsequent logins.
  INSERT INTO public.wallets (wallet_address, chain)
  VALUES (_wallet_addr, 'solana')
  ON CONFLICT (wallet_address, chain) DO NOTHING;

  SELECT * INTO _wallet_row
  FROM public.wallets
  WHERE wallet_address = _wallet_addr
    AND chain = 'solana'
  LIMIT 1;

  RETURN jsonb_build_object(
    'wallet_address',   _wallet_row.wallet_address,
    'verified_x_handle', _wallet_row.verified_x_handle,
    'id',               _wallet_row.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_wallet_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_wallet_profile() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sync_my_twitter_identity
--
-- Called by TwitterLinkSync after the OAuth callback. Reads the Twitter
-- identity from auth.identities (requires SECURITY DEFINER) and writes the
-- handle + ID into the public.wallets row for this user.
--
-- Return value: { ok: true, twitter_id, twitter_handle }
--           or: { ok: false, reason: <code> }
--
-- Reason codes:
--   not_authenticated      — auth.uid() is NULL
--   twitter_not_linked     — identity row not yet committed (retry is safe)
--   no_web3_identity       — Solana identity missing (should not happen)
--   wallet_address_not_found_in_identity — identity_data schema mismatch
--   wallet_not_found       — wallets row missing (ensure_wallet_profile not called)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_my_twitter_identity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid           uuid := auth.uid();
  _tw_identity   auth.identities%ROWTYPE;
  _web3_identity auth.identities%ROWTYPE;
  _wallet_addr   text;
  _tw_id         text;
  _tw_handle     text;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Twitter identity
  SELECT * INTO _tw_identity
  FROM auth.identities
  WHERE user_id = _uid
    AND provider = 'twitter'
  LIMIT 1;

  IF NOT FOUND THEN
    -- Identity write may not have been committed yet — client should retry.
    RETURN jsonb_build_object('ok', false, 'reason', 'twitter_not_linked');
  END IF;

  -- Web3/Solana identity (to look up the wallet address)
  SELECT * INTO _web3_identity
  FROM auth.identities
  WHERE user_id = _uid
    AND provider NOT IN ('twitter', 'email', 'google', 'github', 'facebook', 'discord')
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_web3_identity');
  END IF;

  _wallet_addr := COALESCE(
    NULLIF(_web3_identity.identity_data ->> 'address',        ''),
    NULLIF(_web3_identity.identity_data ->> 'sub',            ''),
    NULLIF(_web3_identity.identity_data ->> 'wallet_address', '')
  );

  IF _wallet_addr IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wallet_address_not_found_in_identity');
  END IF;

  -- Extract Twitter fields. Twitter's API returns different key names between
  -- v1.1 and v2, and Supabase may normalise them differently across versions.
  -- NULLIF(..., '') treats empty strings the same as NULL (handles the
  -- "empty email" bug pattern that Twitter occasionally sends).
  _tw_id := NULLIF(_tw_identity.identity_data ->> 'provider_id', '');

  _tw_handle := COALESCE(
    NULLIF(_tw_identity.identity_data ->> 'user_name',           ''),
    NULLIF(_tw_identity.identity_data ->> 'screen_name',         ''),
    NULLIF(_tw_identity.identity_data ->> 'preferred_username',  '')
  );

  -- Persist into the wallets table (only the columns that exist in the schema)
  UPDATE public.wallets
  SET
    verified_x_id     = _tw_id,
    verified_x_handle = _tw_handle,
    x_verified_at     = now()
  WHERE wallet_address = _wallet_addr
    AND chain = 'solana';

  IF NOT FOUND THEN
    -- The wallets row should have been created by ensure_wallet_profile.
    RETURN jsonb_build_object('ok', false, 'reason', 'wallet_not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok',             true,
    'twitter_id',     _tw_id,
    'twitter_handle', _tw_handle
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_my_twitter_identity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_my_twitter_identity() TO authenticated;
