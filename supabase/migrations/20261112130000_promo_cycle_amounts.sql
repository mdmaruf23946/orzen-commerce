ALTER TABLE public.subscription_coupons
  ADD COLUMN IF NOT EXISTS cycle_amounts jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.subscription_coupons.cycle_amounts IS 'Optional fixed taka discount per billing cycle (monthly/3m/6m/yearly); overrides the per-month multiplied discount.';
