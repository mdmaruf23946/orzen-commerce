
DROP POLICY IF EXISTS "products public read" ON public.products;
CREATE POLICY "products public read active stores" ON public.products
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.status = 'active'));

DROP POLICY IF EXISTS "categories public read" ON public.categories;
CREATE POLICY "categories public read active stores" ON public.categories
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = categories.store_id AND s.status = 'active'));

DROP POLICY IF EXISTS "banners public read" ON public.banners;
CREATE POLICY "banners public read active stores" ON public.banners
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = banners.store_id AND s.status = 'active'));
