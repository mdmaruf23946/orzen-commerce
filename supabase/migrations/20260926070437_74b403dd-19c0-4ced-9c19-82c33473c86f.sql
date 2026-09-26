CREATE TABLE IF NOT EXISTS public.platform_meta_app (
  id INTEGER PRIMARY KEY DEFAULT 1,
  app_id TEXT,
  app_secret_encrypted TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT platform_meta_app_singleton CHECK (id = 1)
);

GRANT ALL ON public.platform_meta_app TO service_role;

ALTER TABLE public.platform_meta_app ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages platform meta app" ON public.platform_meta_app;
CREATE POLICY "service role manages platform meta app"
  ON public.platform_meta_app FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.platform_meta_app (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS platform_meta_app_updated_at ON public.platform_meta_app;
CREATE TRIGGER platform_meta_app_updated_at
  BEFORE UPDATE ON public.platform_meta_app
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();