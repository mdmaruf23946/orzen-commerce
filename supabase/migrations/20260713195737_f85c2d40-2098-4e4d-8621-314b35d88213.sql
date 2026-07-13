
-- store_domains
CREATE TABLE public.store_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  hostname text NOT NULL,
  kind text NOT NULL DEFAULT 'custom' CHECK (kind IN ('custom','subdomain')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','active','failed')),
  verification_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  dns_target text,
  verified_at timestamptz,
  last_checked_at timestamptz,
  ssl_status text NOT NULL DEFAULT 'none' CHECK (ssl_status IN ('none','issuing','issued','failed')),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX store_domains_hostname_key ON public.store_domains (lower(hostname));
CREATE INDEX store_domains_store_id_idx ON public.store_domains (store_id);
CREATE UNIQUE INDEX store_domains_one_primary_per_store
  ON public.store_domains (store_id) WHERE is_primary = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_domains TO authenticated;
GRANT ALL ON public.store_domains TO service_role;

ALTER TABLE public.store_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage own domains"
  ON public.store_domains FOR ALL
  TO authenticated
  USING (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER store_domains_touch
  BEFORE UPDATE ON public.store_domains
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- primary_domain_id on stores
ALTER TABLE public.stores
  ADD COLUMN primary_domain_id uuid REFERENCES public.store_domains(id) ON DELETE SET NULL;

-- resolve_domain RPC (anonymous safe: returns only routing-relevant fields)
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
    'slug', s.slug
  )
  FROM public.store_domains d
  JOIN public.stores s ON s.id = d.store_id
  WHERE lower(d.hostname) = lower(_host)
    AND d.status IN ('verified','active')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_domain(text) TO anon, authenticated;
