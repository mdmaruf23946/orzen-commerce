ALTER TABLE public.facebook_ai_settings
  ADD COLUMN IF NOT EXISTS auto_delete_abusive boolean NOT NULL DEFAULT false;

ALTER TABLE public.facebook_moderation_queue
  ADD COLUMN IF NOT EXISTS decided_by text;