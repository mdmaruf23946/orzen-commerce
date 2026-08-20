CREATE TABLE public.landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Landing Page',
  status text NOT NULL DEFAULT 'draft',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  form_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  views integer NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX landing_pages_store_idx ON public.landing_pages(store_id);
CREATE INDEX landing_pages_status_idx ON public.landing_pages(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_pages TO authenticated;
GRANT ALL ON public.landing_pages TO service_role;

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their landing pages"
ON public.landing_pages FOR ALL TO authenticated
USING (public.is_store_owner(store_id))
WITH CHECK (public.is_store_owner(store_id));

CREATE TABLE public.landing_page_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  hostname text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'subdomain',
  status text NOT NULL DEFAULT 'pending',
  ssl_status text NOT NULL DEFAULT 'pending',
  dns_target text,
  verification_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  cf_hostname_id text,
  cf_status text,
  cf_ssl_status text,
  cf_ownership jsonb,
  cf_ssl_validation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX landing_page_domains_page_idx ON public.landing_page_domains(landing_page_id);
CREATE UNIQUE INDEX landing_page_domains_one_subdomain
  ON public.landing_page_domains(landing_page_id) WHERE kind = 'subdomain';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_page_domains TO authenticated;
GRANT ALL ON public.landing_page_domains TO service_role;

ALTER TABLE public.landing_page_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their landing page domains"
ON public.landing_page_domains FOR ALL TO authenticated
USING (public.is_store_owner(store_id))
WITH CHECK (public.is_store_owner(store_id));

CREATE TRIGGER landing_pages_touch
BEFORE UPDATE ON public.landing_pages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER landing_page_domains_touch
BEFORE UPDATE ON public.landing_page_domains
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_public_landing_page(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', lp.id,
    'store_id', lp.store_id,
    'slug', lp.slug,
    'title', lp.title,
    'content', lp.content,
    'theme', lp.theme,
    'form_config', lp.form_config,
    'seo', lp.seo,
    'product', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'price', p.price,
      'old_price', p.old_price,
      'stock', p.stock,
      'status', p.status
    ) END,
    'store', jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug)
  )
  FROM public.landing_pages lp
  JOIN public.stores s ON s.id = lp.store_id
  LEFT JOIN public.products p ON p.id = lp.product_id
  WHERE lp.slug = lower(_slug)
    AND lp.status = 'published'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_landing_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_landing_page(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_landing_slug_taken(_slug text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.landing_pages WHERE slug = lower(_slug))
      OR EXISTS (SELECT 1 FROM public.stores WHERE slug = lower(_slug));
$$;

REVOKE ALL ON FUNCTION public.is_landing_slug_taken(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_landing_slug_taken(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_host_kind(_host text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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

REVOKE ALL ON FUNCTION public.resolve_host_kind(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_host_kind(text) TO anon, authenticated, service_role;