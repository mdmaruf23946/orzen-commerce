CREATE OR REPLACE FUNCTION public.__mig_auth_dump(_table text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE r jsonb;
BEGIN
  IF _table NOT IN ('users','identities','mfa_amr_claims','sessions','refresh_tokens') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  EXECUTE format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from auth.%I t', _table) INTO r;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.__mig_auth_dump(text) FROM PUBLIC, anon, authenticated;