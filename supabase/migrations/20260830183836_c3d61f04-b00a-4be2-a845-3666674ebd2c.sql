ALTER TABLE public.ai_global_settings
  ADD COLUMN IF NOT EXISTS gemini_api_keys jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.ai_global_settings
SET gemini_api_keys = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'label', 'Key 1',
    'key', gemini_api_key,
    'enabled', true,
    'failed_on', NULL,
    'last_error', NULL
  )
)
WHERE gemini_api_key IS NOT NULL
  AND length(trim(gemini_api_key)) > 0
  AND jsonb_array_length(gemini_api_keys) = 0;