CREATE POLICY "stores public active check"
ON public.stores FOR SELECT
TO anon, authenticated
USING (status = 'active');