
ALTER TABLE public.fraud_settings
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_ok boolean,
  ADD COLUMN IF NOT EXISTS last_test_error text,
  ADD COLUMN IF NOT EXISTS last_test_sample jsonb;
