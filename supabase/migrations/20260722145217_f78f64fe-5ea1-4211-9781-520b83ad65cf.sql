
ALTER TABLE public.store_duplicate_protection
  ADD COLUMN IF NOT EXISTS messenger_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rule_psid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS messenger_custom_reply text;

ALTER TABLE public.store_duplicate_blocks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS psid text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS allow_duplicate boolean NOT NULL DEFAULT false;
