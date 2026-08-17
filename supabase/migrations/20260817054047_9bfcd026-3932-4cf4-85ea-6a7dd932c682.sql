CREATE OR REPLACE FUNCTION public.domain_token_exists(_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_domains
    WHERE verification_token = _token
      AND _token IS NOT NULL
      AND length(_token) >= 12
  );
$$;

REVOKE ALL ON FUNCTION public.domain_token_exists(text) FROM public;
GRANT EXECUTE ON FUNCTION public.domain_token_exists(text) TO anon, authenticated, service_role;