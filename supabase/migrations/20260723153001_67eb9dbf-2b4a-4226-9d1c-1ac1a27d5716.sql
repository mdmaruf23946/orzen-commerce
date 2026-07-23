
CREATE OR REPLACE FUNCTION public.is_store_active(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND status = 'active');
$$;

REVOKE ALL ON FUNCTION public.is_store_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_store_active(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "products public read active stores" ON public.products;
CREATE POLICY "products public read active stores" ON public.products
  FOR SELECT TO public
  USING (public.is_store_active(store_id));

DROP POLICY IF EXISTS "categories public read active stores" ON public.categories;
CREATE POLICY "categories public read active stores" ON public.categories
  FOR SELECT TO public
  USING (public.is_store_active(store_id));

DROP POLICY IF EXISTS "banners public read active stores" ON public.banners;
CREATE POLICY "banners public read active stores" ON public.banners
  FOR SELECT TO public
  USING (public.is_store_active(store_id));
