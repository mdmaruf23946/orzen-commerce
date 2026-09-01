CREATE OR REPLACE FUNCTION public.landing_public_host(_slug text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text;
  h text;
BEGIN
  s := lower(trim(_slug));
  IF s IS NULL OR s = '' THEN RETURN NULL; END IF;

  -- 1. Custom domain attached to this landing page (central Domain settings).
  SELECT lower(d.hostname) INTO h
  FROM public.store_domains d
  JOIN public.landing_pages lp ON lp.id = d.landing_page_id
  WHERE lp.slug = s AND d.status IN ('verified', 'active')
  ORDER BY d.is_primary DESC NULLS LAST
  LIMIT 1;
  IF h IS NOT NULL THEN RETURN h; END IF;

  -- 2. Platform subdomain registered for this landing page.
  SELECT lower(d.hostname) INTO h
  FROM public.landing_page_domains d
  JOIN public.landing_pages lp ON lp.id = d.landing_page_id
  WHERE lp.slug = s AND (d.kind = 'subdomain' OR d.status IN ('verified', 'active'))
  ORDER BY d.created_at ASC
  LIMIT 1;

  RETURN h;
END;
$$;

GRANT EXECUTE ON FUNCTION public.landing_public_host(text) TO anon, authenticated, service_role;