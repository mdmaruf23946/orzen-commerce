ALTER TABLE public.ai_global_settings
  ADD COLUMN IF NOT EXISTS temperature numeric DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS max_tokens int DEFAULT 2048,
  ADD COLUMN IF NOT EXISTS global_system_prompt text DEFAULT '',
  ADD COLUMN IF NOT EXISTS safety_rules text DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_voice text DEFAULT '',
  ADD COLUMN IF NOT EXISTS supported_languages text[] DEFAULT ARRAY['bn','en'],
  ADD COLUMN IF NOT EXISTS fallback_model text;