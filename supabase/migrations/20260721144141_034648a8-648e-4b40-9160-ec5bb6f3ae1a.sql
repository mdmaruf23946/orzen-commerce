ALTER TABLE public.messenger_integrations
  ADD COLUMN IF NOT EXISTS privacy_policy_url text,
  ADD COLUMN IF NOT EXISTS terms_of_service_url text;