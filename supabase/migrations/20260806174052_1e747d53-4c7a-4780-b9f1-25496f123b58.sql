DROP POLICY IF EXISTS "banners public read active stores" ON public.banners;
CREATE POLICY "banners public read active stores" ON public.banners
FOR SELECT TO anon, authenticated
USING (public.is_store_active(store_id));

DROP POLICY IF EXISTS "categories public read active stores" ON public.categories;
CREATE POLICY "categories public read active stores" ON public.categories
FOR SELECT TO anon, authenticated
USING (public.is_store_active(store_id));