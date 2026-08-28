CREATE TABLE public.store_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  page_key text NOT NULL,
  title text NOT NULL DEFAULT '',
  content_html text NOT NULL DEFAULT '',
  seo_description text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, page_key)
);

GRANT SELECT ON public.store_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_pages TO authenticated;
GRANT ALL ON public.store_pages TO service_role;

ALTER TABLE public.store_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published store pages"
ON public.store_pages FOR SELECT TO anon, authenticated
USING (is_published = true);

CREATE POLICY "Store team can manage their pages"
ON public.store_pages FOR ALL TO authenticated
USING (public.has_store_access(store_id))
WITH CHECK (public.has_store_access(store_id));

CREATE TRIGGER trg_store_pages_updated_at
BEFORE UPDATE ON public.store_pages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_store_pages_store ON public.store_pages(store_id);

-- Backfill from existing generated legal pages
INSERT INTO public.store_pages (store_id, page_key, title, content_html, seo_description, is_published)
SELECT
  li.store_id,
  m.new_key,
  COALESCE(NULLIF(li.pages -> m.old_key ->> 'title', ''), m.default_title),
  COALESCE(li.pages -> m.old_key ->> 'html', ''),
  NULLIF(li.pages -> m.old_key ->> 'description', ''),
  true
FROM public.store_legal_info li
CROSS JOIN (VALUES
  ('privacy', 'privacy-policy', 'Privacy Policy'),
  ('terms', 'terms-conditions', 'Terms & Conditions'),
  ('refund', 'return-refund-policy', 'Return & Refund Policy'),
  ('shipping', 'shipping-policy', 'Shipping Policy'),
  ('contact', 'contact-us', 'Contact Us'),
  ('about', 'about-us', 'About Us')
) AS m(old_key, new_key, default_title)
WHERE li.pages IS NOT NULL AND li.pages ? m.old_key
ON CONFLICT (store_id, page_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_store_page(_slug text, _page_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'store', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'slug', s.slug,
      'email', s.email,
      'phone', s.phone,
      'whatsapp', s.whatsapp,
      'address', s.address
    ),
    'page', (
      SELECT to_jsonb(p) - 'store_id'
      FROM public.store_pages p
      WHERE p.store_id = s.id AND p.page_key = _page_key AND p.is_published = true
    )
  )
  FROM public.stores s
  WHERE s.slug = _slug
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_store_page(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_page(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_store_pages_public(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('page_key', p.page_key, 'title', p.title)), '[]'::jsonb)
  FROM public.stores s
  JOIN public.store_pages p ON p.store_id = s.id AND p.is_published = true
  WHERE s.slug = _slug;
$$;

REVOKE ALL ON FUNCTION public.list_store_pages_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_store_pages_public(text) TO anon, authenticated, service_role;