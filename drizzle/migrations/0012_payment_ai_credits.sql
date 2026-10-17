ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS ai_credit_bundle_id uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS ai_credits_extra integer NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS ai_credits_price numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS ai_credits_granted boolean NOT NULL DEFAULT false;