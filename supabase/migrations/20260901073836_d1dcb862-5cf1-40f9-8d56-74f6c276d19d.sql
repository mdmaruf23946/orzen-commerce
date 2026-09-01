CREATE OR REPLACE FUNCTION public.resolve_host_kind(_host text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h text;
  root text;
  lbl text;
  res jsonb;
BEGIN
  h := lower(trim(_host));
  IF h IS NULL OR h = '' THEN RETURN NULL; END IF;

  SELECT coalesce(public.platform_routing_hosts() ->> 'root_domain', 'orzen.top') INTO root;

  -- 1. Custom domain attached to a landing page (central Domain settings).
  SELECT jsonb_build_object('kind', 'landing', 'slug', lp.slug, 'primary_hostname', NULL)
    INTO res
  FROM public.store_domains d
  JOIN public.landing_pages lp ON lp.id = d.landing_page_id
  WHERE lower(d.hostname) = h
    AND d.status IN ('verified', 'active')
  LIMIT 1;
  IF res IS NOT NULL THEN RETURN res; END IF;

  -- 2. Landing page subdomain.
  SELECT jsonb_build_object('kind', 'landing', 'slug', lp.slug, 'primary_hostname', NULL)
    INTO res
  FROM public.landing_page_domains d
  JOIN public.landing_pages lp ON lp.id = d.landing_page_id
  WHERE lower(d.hostname) = h
    AND (d.kind = 'subdomain' OR d.status IN ('verified', 'active'))
  LIMIT 1;
  IF res IS NOT NULL THEN RETURN res; END IF;

  res := public.resolve_domain(h);
  IF res IS NOT NULL AND res ->> 'slug' IS NOT NULL THEN
    RETURN res || jsonb_build_object('kind', 'store');
  END IF;

  IF h LIKE ('%.' || root) THEN
    lbl := left(h, length(h) - length(root) - 1);
    IF position('.' IN lbl) = 0 THEN
      SELECT jsonb_build_object('kind', 'store', 'slug', s.slug, 'primary_hostname', NULL)
        INTO res
      FROM public.stores s WHERE s.slug = lbl LIMIT 1;
      IF res IS NOT NULL THEN RETURN res; END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;