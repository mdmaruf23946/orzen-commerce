ALTER TABLE public.facebook_page_integrations
  ADD COLUMN IF NOT EXISTS manual_token boolean NOT NULL DEFAULT false;