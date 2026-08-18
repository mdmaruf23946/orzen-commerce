DROP POLICY IF EXISTS "store_themes public read published" ON public.store_themes;

CREATE POLICY "store_themes anon read published"
ON public.store_themes
FOR SELECT
TO anon
USING (status = 'published');

CREATE POLICY "store_themes authenticated read"
ON public.store_themes
FOR SELECT
TO authenticated
USING (status = 'published' OR public.has_role(auth.uid(), 'owner'));