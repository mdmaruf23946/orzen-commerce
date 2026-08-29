CREATE POLICY "products public read active"
ON public.products FOR SELECT
TO anon, authenticated
USING (status = 'active'::product_status);