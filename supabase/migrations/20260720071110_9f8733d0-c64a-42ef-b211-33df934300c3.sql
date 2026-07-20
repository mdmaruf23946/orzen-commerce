DROP POLICY IF EXISTS "notices public" ON public.platform_notices;
CREATE POLICY "notices public active" ON public.platform_notices FOR SELECT USING (is_active = true);