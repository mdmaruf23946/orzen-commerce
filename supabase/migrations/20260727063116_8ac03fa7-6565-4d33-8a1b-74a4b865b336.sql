
CREATE TABLE IF NOT EXISTS public.platform_branding (
  id text PRIMARY KEY DEFAULT 'global',
  assets jsonb NOT NULL DEFAULT '{}'::jsonb,
  combo jsonb NOT NULL DEFAULT '{"mode":"both","layout":"left","align":"start","gap":8,"logoSize":32,"wordmarkSize":24}'::jsonb,
  placements jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_branding TO anon, authenticated;
GRANT ALL ON public.platform_branding TO service_role;

ALTER TABLE public.platform_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_branding public read" ON public.platform_branding;
CREATE POLICY "platform_branding public read" ON public.platform_branding
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "platform_branding owner write" ON public.platform_branding;
CREATE POLICY "platform_branding owner write" ON public.platform_branding
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'owner'));

-- Ensure a single global row exists
INSERT INTO public.platform_branding (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- Public RPC for SSR / anonymous consumers
CREATE OR REPLACE FUNCTION public.get_platform_branding()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'assets', COALESCE(assets, '{}'::jsonb),
    'combo', COALESCE(combo, '{}'::jsonb),
    'placements', COALESCE(placements, '{}'::jsonb),
    'published_at', published_at,
    'updated_at', updated_at
  )
  FROM public.platform_branding WHERE id = 'global' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_platform_branding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_branding() TO anon, authenticated, service_role;

-- Storage write policy for platform-branding/* in store-assets bucket
DROP POLICY IF EXISTS "Owners can upload platform-branding assets" ON storage.objects;
CREATE POLICY "Owners can upload platform-branding assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-assets'
    AND (storage.foldername(name))[1] = 'platform-branding'
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'owner')
  );

DROP POLICY IF EXISTS "Owners can update platform-branding assets" ON storage.objects;
CREATE POLICY "Owners can update platform-branding assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-assets'
    AND (storage.foldername(name))[1] = 'platform-branding'
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'owner')
  );

DROP POLICY IF EXISTS "Owners can delete platform-branding assets" ON storage.objects;
CREATE POLICY "Owners can delete platform-branding assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-assets'
    AND (storage.foldername(name))[1] = 'platform-branding'
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'owner')
  );

DROP POLICY IF EXISTS "Public can read platform-branding assets" ON storage.objects;
CREATE POLICY "Public can read platform-branding assets" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'store-assets'
    AND (storage.foldername(name))[1] = 'platform-branding'
  );
