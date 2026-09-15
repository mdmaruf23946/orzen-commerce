ALTER TABLE public.messenger_integrations
  ADD COLUMN IF NOT EXISTS reply_delay_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_speed text NOT NULL DEFAULT 'fastest';

ALTER TABLE public.messenger_integrations
  DROP CONSTRAINT IF EXISTS messenger_integrations_reply_speed_check;
ALTER TABLE public.messenger_integrations
  ADD CONSTRAINT messenger_integrations_reply_speed_check CHECK (reply_speed IN ('fastest','balanced','thorough'));

ALTER TABLE public.messenger_integrations
  DROP CONSTRAINT IF EXISTS messenger_integrations_reply_delay_check;
ALTER TABLE public.messenger_integrations
  ADD CONSTRAINT messenger_integrations_reply_delay_check CHECK (reply_delay_seconds >= 0 AND reply_delay_seconds <= 600);