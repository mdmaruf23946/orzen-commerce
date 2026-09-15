ALTER TABLE public.facebook_page_integrations
  ADD COLUMN IF NOT EXISTS permissions_verified jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS permissions_checked_at timestamptz;