ALTER TABLE public.store_domains
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS verification_method text;

-- One hostname can only ever belong to one store.
DELETE FROM public.store_domains a
  USING public.store_domains b
  WHERE lower(a.hostname) = lower(b.hostname)
    AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS store_domains_hostname_lower_uidx
  ON public.store_domains (lower(hostname));

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
  LIMIT 1;
$$;