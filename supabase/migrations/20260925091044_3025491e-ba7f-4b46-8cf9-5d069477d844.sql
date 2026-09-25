CREATE POLICY "Service role manages AI product catalog"
ON public.ai_product_catalog
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);