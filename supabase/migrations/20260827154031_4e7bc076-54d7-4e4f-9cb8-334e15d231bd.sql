CREATE OR REPLACE FUNCTION public.get_global_header_banner()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'enabled', COALESCE((settings->'global_banner'->>'enabled')::boolean, false),
    'image_url', NULLIF(settings->'global_banner'->>'image_url', ''),
    'link_url', NULLIF(settings->'global_banner'->>'link_url', ''),
    'alt', NULLIF(settings->'global_banner'->>'alt', '')
  )
  FROM public.platform_settings
  WHERE id = 1
$$;
REVOKE ALL ON FUNCTION public.get_global_header_banner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_global_header_banner() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "products public read active published" ON public.products;
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT ON public.storefront_products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;