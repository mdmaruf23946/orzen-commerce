ALTER TABLE public.subscription_coupons
  ADD COLUMN IF NOT EXISTS max_discount numeric,
  ADD COLUMN IF NOT EXISTS plan_amounts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.subscription_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS coupon_counted boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_payments_coupon ON public.payments(coupon_id) WHERE coupon_id IS NOT NULL;