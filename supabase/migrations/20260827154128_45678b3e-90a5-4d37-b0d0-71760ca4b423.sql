CREATE TABLE public.platform_global_banner (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  image_url text,
  link_url text,
  alt text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_global_banner TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_global_banner TO authenticated;
GRANT ALL ON public.platform_global_banner TO service_role;
ALTER TABLE public.platform_global_banner ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view global banner"
ON public.platform_global_banner
FOR SELECT
TO anon, authenticated
USING (true);
CREATE POLICY "Owners can create global banner"
ON public.platform_global_banner
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update global banner"
ON public.platform_global_banner
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete global banner"
ON public.platform_global_banner
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

INSERT INTO public.platform_global_banner (id, enabled, image_url, link_url, alt)
SELECT
  1,
  COALESCE((settings->'global_banner'->>'enabled')::boolean, false),
  NULLIF(settings->'global_banner'->>'image_url', ''),
  NULLIF(settings->'global_banner'->>'link_url', ''),
  NULLIF(settings->'global_banner'->>'alt', '')
FROM public.platform_settings
WHERE id = 1
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.platform_global_banner (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP FUNCTION IF EXISTS public.get_global_header_banner();