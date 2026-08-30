ALTER TABLE public.fraud_settings ADD COLUMN IF NOT EXISTS api_keys jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Seed the existing single key as the first key in the rotation list
UPDATE public.fraud_settings
SET api_keys = jsonb_build_array(jsonb_build_object(
  'id', gen_random_uuid()::text,
  'label', 'Primary key',
  'key', api_key,
  'enabled', true,
  'failed_on', NULL,
  'last_error', NULL,
  'last_used_at', NULL
))
WHERE id = 'global' AND api_key IS NOT NULL AND api_key <> '' AND (api_keys IS NULL OR jsonb_array_length(api_keys) = 0);