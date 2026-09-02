ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS subdomain_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS subdomain_release_reason text;