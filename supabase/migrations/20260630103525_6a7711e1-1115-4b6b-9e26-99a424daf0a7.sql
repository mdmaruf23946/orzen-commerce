
-- 1) Plan tier + feature summary
ALTER TABLE public.subscription_packages
  ADD COLUMN IF NOT EXISTS plan_tier text,
  ADD COLUMN IF NOT EXISTS feature_summary text[];

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_packages_plan_tier_check') THEN
    ALTER TABLE public.subscription_packages
      ADD CONSTRAINT subscription_packages_plan_tier_check
      CHECK (plan_tier IS NULL OR plan_tier IN ('free','basic','business','custom'));
  END IF;
END $$;

-- Tag existing lunex plan as business
UPDATE public.subscription_packages
  SET plan_tier = 'business'
  WHERE lower(name) = 'lunex' AND plan_tier IS NULL;

-- Seed canonical plans if missing
INSERT INTO public.subscription_packages (name, description, price, duration_days, billing_cycle, product_limit, order_limit, customer_limit, staff_limit, storage_mb, is_active, is_trial, sort_order, plan_tier, features)
SELECT 'Free', 'Get started with the essentials.', 0, 30, 'monthly', 20, 50, 100, 0, 100, true, false, 1, 'free',
  '{"invoice":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_packages WHERE plan_tier = 'free');

INSERT INTO public.subscription_packages (name, description, price, duration_days, billing_cycle, product_limit, order_limit, customer_limit, staff_limit, storage_mb, is_active, is_trial, sort_order, plan_tier, features)
SELECT 'Basic', 'For growing stores.', 299, 30, 'monthly', 200, 500, 1000, 2, 1024, true, false, 2, 'basic',
  '{"invoice":true,"inventory":true,"coupons":true,"analytics":true,"import_export":true,"bulk_actions":true,"customer_notes":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_packages WHERE plan_tier = 'basic');

INSERT INTO public.subscription_packages (name, description, price, duration_days, billing_cycle, product_limit, order_limit, customer_limit, staff_limit, storage_mb, is_active, is_trial, sort_order, plan_tier, features)
SELECT 'Custom', 'Tailored for high-volume businesses.', 0, 30, 'monthly', 0, 0, 0, 0, 0, true, false, 4, 'custom',
  '{"ai_agent":true,"ai_messenger":true,"pixel":true,"courier":true,"inventory":true,"coupons":true,"invoice":true,"analytics":true,"import_export":true,"bulk_actions":true,"staff":true,"customer_notes":true,"returns":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_packages WHERE plan_tier = 'custom');

-- Ensure business tier exists (if lunex wasn't there)
INSERT INTO public.subscription_packages (name, description, price, duration_days, billing_cycle, product_limit, order_limit, customer_limit, staff_limit, storage_mb, is_active, is_trial, sort_order, plan_tier, features)
SELECT 'Business', 'Most popular for established stores.', 799, 30, 'monthly', 2000, 5000, 10000, 5, 5120, true, false, 3, 'business',
  '{"ai_agent":true,"ai_messenger":true,"pixel":true,"courier":true,"inventory":true,"coupons":true,"invoice":true,"analytics":true,"import_export":true,"bulk_actions":true,"staff":true,"customer_notes":true,"returns":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_packages WHERE plan_tier = 'business');

-- 2) platform_billing_settings
CREATE TABLE IF NOT EXISTS public.platform_billing_settings (
  id text PRIMARY KEY DEFAULT 'global',
  discount_3m numeric NOT NULL DEFAULT 5,
  discount_6m numeric NOT NULL DEFAULT 10,
  discount_yearly numeric NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_billing_settings TO anon, authenticated;
GRANT ALL ON public.platform_billing_settings TO service_role;

ALTER TABLE public.platform_billing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read billing settings" ON public.platform_billing_settings;
CREATE POLICY "Anyone can read billing settings"
  ON public.platform_billing_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Only owners can modify billing settings" ON public.platform_billing_settings;
CREATE POLICY "Only owners can modify billing settings"
  ON public.platform_billing_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

INSERT INTO public.platform_billing_settings (id) VALUES ('global')
  ON CONFLICT (id) DO NOTHING;

-- 3) Trial expiry helper: when a store's trial expires, move it to the Free plan
CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE free_id uuid;
BEGIN
  SELECT id INTO free_id FROM public.subscription_packages
    WHERE plan_tier = 'free' AND is_active = true ORDER BY sort_order LIMIT 1;
  UPDATE public.stores s
     SET package_id = COALESCE(free_id, s.package_id),
         subscription_status = 'active',
         trial_ends_at = NULL,
         expires_at = now() + interval '30 days'
   WHERE subscription_status = 'trialing'
     AND trial_ends_at IS NOT NULL
     AND trial_ends_at < now();
END $$;

-- Make refresh_store_subscription_status also call expire_trials first
CREATE OR REPLACE FUNCTION public.refresh_store_subscription_status(_store_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE free_id uuid;
BEGIN
  -- Auto-downgrade if trial has expired
  SELECT id INTO free_id FROM public.subscription_packages
    WHERE plan_tier = 'free' AND is_active = true ORDER BY sort_order LIMIT 1;
  UPDATE public.stores
     SET package_id = COALESCE(free_id, package_id),
         subscription_status = 'active',
         trial_ends_at = NULL,
         expires_at = now() + interval '30 days'
   WHERE id = _store_id
     AND subscription_status = 'trialing'
     AND trial_ends_at IS NOT NULL
     AND trial_ends_at < now();

  UPDATE public.stores
     SET subscription_status = CASE
       WHEN subscription_status = 'suspended' THEN 'suspended'
       WHEN expires_at IS NULL THEN subscription_status
       WHEN expires_at < now() THEN 'expired'
       WHEN expires_at >= now() AND last_renewed_at IS NOT NULL THEN 'active'
       WHEN expires_at >= now() AND trial_ends_at IS NOT NULL AND expires_at = trial_ends_at THEN 'trialing'
       ELSE 'active'
     END
   WHERE id = _store_id;
END $function$;
