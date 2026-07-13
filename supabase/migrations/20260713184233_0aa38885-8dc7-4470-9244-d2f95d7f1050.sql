-- Restrict anon read on stores; expose a safe SECURITY DEFINER RPC for the storefront
-- that omits sensitive integration secrets (couriers, marketing.fb_capi_token).

CREATE OR REPLACE FUNCTION public.get_public_store_by_slug(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'slug', s.slug,
    'name', s.name,
    'description', s.description,
    'logo_url', s.logo_url,
    'phone', s.phone,
    'whatsapp', s.whatsapp,
    'facebook', s.facebook,
    'address', s.address,
    'primary_color', s.primary_color,
    'header_color', s.header_color,
    'title_bar_color', s.title_bar_color,
    'footer_color', s.footer_color,
    'button_color', s.button_color,
    'bkash_number', s.bkash_number,
    'nagad_number', s.nagad_number,
    'status', s.status::text,
    -- Public marketing config, without the server-side Facebook CAPI token
    'marketing', COALESCE(s.marketing, '{}'::jsonb) - 'fb_capi_token',
    'seo', s.seo,
    'theme', s.theme,
    'delivery', s.delivery,
    'payments_config', s.payments_config
  )
  FROM public.stores s
  WHERE s.slug = _slug AND s.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_store_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_store_by_slug(text) TO anon, authenticated;

-- Replace the permissive anon-visible SELECT policy with an owner/platform-only one.
DROP POLICY IF EXISTS "active stores public" ON public.stores;

CREATE POLICY "owners and platform read stores"
ON public.stores
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_user_id
  OR has_role(auth.uid(), 'owner'::app_role)
);