
-- Per-store AI configuration
CREATE TABLE IF NOT EXISTS public.store_ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  provider text NOT NULL DEFAULT 'platform',
  model text,
  openai_api_key text,
  gemini_api_key text,
  monthly_token_limit integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ai_config TO authenticated;
GRANT ALL ON public.store_ai_config TO service_role;

ALTER TABLE public.store_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages all store ai config" ON public.store_ai_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Store owner reads own ai config" ON public.store_ai_config
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_ai_config.store_id AND s.owner_user_id = auth.uid()));

CREATE TRIGGER trg_store_ai_config_touch BEFORE UPDATE ON public.store_ai_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Extend global ai settings with optional fallback OpenAI/Gemini keys
ALTER TABLE public.ai_global_settings
  ADD COLUMN IF NOT EXISTS openai_api_key text,
  ADD COLUMN IF NOT EXISTS gemini_api_key text;
