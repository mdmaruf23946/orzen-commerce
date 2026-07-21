
CREATE TABLE public.store_legal_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  owner_name text NOT NULL,
  support_email text NOT NULL,
  contact_phone text NOT NULL,
  business_address text NOT NULL,
  website_domain text NOT NULL,
  country text NOT NULL,
  currency text NOT NULL,
  pages jsonb NOT NULL DEFAULT '{}'::jsonb,
  pages_version integer NOT NULL DEFAULT 0,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_legal_info TO authenticated;
GRANT ALL ON public.store_legal_info TO service_role;

ALTER TABLE public.store_legal_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their store legal info"
  ON public.store_legal_info FOR ALL
  TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE TRIGGER trg_store_legal_info_updated
  BEFORE UPDATE ON public.store_legal_info
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_store_legal_page(_slug text, _page text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'store', jsonb_build_object(
      'id', s.id, 'slug', s.slug, 'name', s.name,
      'logo_url', s.logo_url,
      'primary_color', s.primary_color,
      'header_color', s.header_color,
      'footer_color', s.footer_color
    ),
    'page', COALESCE(li.pages -> _page, NULL),
    'info', CASE WHEN li.id IS NULL THEN NULL ELSE jsonb_build_object(
      'store_name', li.store_name,
      'owner_name', li.owner_name,
      'support_email', li.support_email,
      'contact_phone', li.contact_phone,
      'business_address', li.business_address,
      'website_domain', li.website_domain,
      'country', li.country,
      'currency', li.currency,
      'generated_at', li.generated_at
    ) END
  )
  FROM public.stores s
  LEFT JOIN public.store_legal_info li ON li.store_id = s.id
  WHERE s.slug = _slug AND s.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_store_legal_page(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_legal_page(text, text) TO anon, authenticated;
