ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'plan';
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_purpose_check CHECK (purpose IN ('plan','wallet_topup'));
CREATE INDEX IF NOT EXISTS payments_purpose_idx ON public.payments (purpose);