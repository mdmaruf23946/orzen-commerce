ALTER TABLE public.messenger_integrations
  ADD COLUMN IF NOT EXISTS instagram_account_id text,
  ADD COLUMN IF NOT EXISTS instagram_username text,
  ADD COLUMN IF NOT EXISTS instagram_picture_url text,
  ADD COLUMN IF NOT EXISTS instagram_connected_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS messenger_integrations_instagram_account_uidx
  ON public.messenger_integrations (instagram_account_id) WHERE instagram_account_id IS NOT NULL;