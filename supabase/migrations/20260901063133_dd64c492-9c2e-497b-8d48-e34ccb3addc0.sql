ALTER TABLE public.store_domains
  ADD COLUMN IF NOT EXISTS landing_page_id uuid REFERENCES public.landing_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS store_domains_landing_page_id_idx
  ON public.store_domains (landing_page_id) WHERE landing_page_id IS NOT NULL;

-- Move any custom domains that were created inside the landing builder into the
-- central store_domains table, keeping them attached to their landing page.
INSERT INTO public.store_domains (
  store_id, hostname, kind, status, dns_target, verification_token,
  verified_at, last_checked_at, last_error, ssl_status,
  cf_hostname_id, cf_status, cf_ssl_status, cf_ownership, cf_ssl_validation,
  landing_page_id
)
SELECT d.store_id, lower(d.hostname), 'custom', d.status, d.dns_target, d.verification_token,
       d.verified_at, d.last_checked_at, d.last_error, d.ssl_status,
       d.cf_hostname_id, d.cf_status, d.cf_ssl_status, d.cf_ownership, d.cf_ssl_validation,
       d.landing_page_id
FROM public.landing_page_domains d
WHERE d.kind = 'custom'
  AND NOT EXISTS (
    SELECT 1 FROM public.store_domains s WHERE lower(s.hostname) = lower(d.hostname)
  );

DELETE FROM public.landing_page_domains WHERE kind = 'custom';

-- Storefront resolution must ignore domains that are attached to a landing page.
CREATE OR REPLACE FUNCTION public.resolve_domain(_host text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'store_id', d.store_id,
    'hostname', d.hostname,
    'status', d.status,
    'is_primary', d.is_primary,
    'slug', s.slug,
    'primary_hostname', (
      SELECT p.hostname
      FROM public.store_domains p
      WHERE p.id = s.primary_domain_id
        AND p.status IN ('verified','active')
      LIMIT 1
    )
  )
  FROM public.store_domains d
  JOIN public.stores s ON s.id = d.store_id
  WHERE lower(d.hostname) = lower(_host)
    AND d.status IN ('verified','active')
    AND d.landing_page_id IS NULL
  LIMIT 1;
$$;

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
    AND lp.status = 'published'
  LIMIT 1;
  IF res IS NOT NULL THEN RETURN res; END IF;

  -- 2. Landing page subdomain.
  SELECT jsonb_build_object('kind', 'landing', 'slug', lp.slug, 'primary_hostname', NULL)
    INTO res
  FROM public.landing_page_domains d
  JOIN public.landing_pages lp ON lp.id = d.landing_page_id
  WHERE lower(d.hostname) = h
    AND lp.status = 'published'
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