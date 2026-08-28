DROP POLICY IF EXISTS "products public read active published" ON public.products;
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT ON public.storefront_products TO anon, authenticated;
GRANT ALL ON public.storefront_products TO service_role;
GRANT ALL ON public.products TO service_role;