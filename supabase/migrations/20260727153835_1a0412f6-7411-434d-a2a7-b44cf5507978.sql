ALTER TABLE public.notification_campaigns
  ADD COLUMN IF NOT EXISTS subject text;