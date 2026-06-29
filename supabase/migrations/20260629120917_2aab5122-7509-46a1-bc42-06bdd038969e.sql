
-- 1. subscription_packages: new columns
ALTER TABLE public.subscription_packages
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_days int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_limit int,
  ADD COLUMN IF NOT EXISTS customer_limit int,
  ADD COLUMN IF NOT EXISTS staff_limit int,
  ADD COLUMN IF NOT EXISTS storage_mb int,
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- 2. stores: subscription status fields
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_renewed_at timestamptz;

-- 3. payments: invoice + verification fields
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS invoice_no text,
  ADD COLUMN IF NOT EXISTS cycle_start date,
  ADD COLUMN IF NOT EXISTS cycle_end date,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS sender_number text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_no) WHERE invoice_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON public.payments(status, created_at DESC);

-- 4. platform_payment_settings (single-row, owner-only)
CREATE TABLE IF NOT EXISTS public.platform_payment_settings (
  id text PRIMARY KEY DEFAULT 'global',
  bkash jsonb NOT NULL DEFAULT '{}'::jsonb,
  nagad jsonb NOT NULL DEFAULT '{}'::jsonb,
  rocket jsonb NOT NULL DEFAULT '{}'::jsonb,
  sslcommerz jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.platform_payment_settings TO authenticated;
GRANT ALL ON public.platform_payment_settings TO service_role;
ALTER TABLE public.platform_payment_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner manages payment settings" ON public.platform_payment_settings;
CREATE POLICY "owner manages payment settings" ON public.platform_payment_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));

INSERT INTO public.platform_payment_settings(id) VALUES ('global') ON CONFLICT DO NOTHING;

-- 5. subscription_notifications
CREATE TABLE IF NOT EXISTS public.subscription_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type text NOT NULL,
  read_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subnotif_store_created ON public.subscription_notifications(store_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_notifications TO authenticated;
GRANT ALL ON public.subscription_notifications TO service_role;
ALTER TABLE public.subscription_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store owner reads notifications" ON public.subscription_notifications;
CREATE POLICY "store owner reads notifications" ON public.subscription_notifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid())
         OR public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS "store owner marks read" ON public.subscription_notifications;
CREATE POLICY "store owner marks read" ON public.subscription_notifications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()));
DROP POLICY IF EXISTS "owner inserts notifications" ON public.subscription_notifications;
CREATE POLICY "owner inserts notifications" ON public.subscription_notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner')
              OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()));

-- 6. Trial auto-start trigger
CREATE OR REPLACE FUNCTION public.start_trial_for_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE pkg record;
BEGIN
  IF NEW.package_id IS NULL THEN
    SELECT id, trial_days INTO pkg FROM public.subscription_packages
      WHERE is_trial = true AND is_active = true ORDER BY sort_order, created_at LIMIT 1;
    IF pkg.id IS NOT NULL THEN
      NEW.package_id := pkg.id;
      NEW.trial_ends_at := now() + (COALESCE(pkg.trial_days, 3) || ' days')::interval;
      NEW.expires_at := NEW.trial_ends_at;
      NEW.subscription_status := 'trialing';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_start_trial_for_store ON public.stores;
CREATE TRIGGER trg_start_trial_for_store
BEFORE INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.start_trial_for_store();

-- 7. helper to refresh status from expiry
CREATE OR REPLACE FUNCTION public.refresh_store_subscription_status(_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
END $$;

-- 8. Seed a default trial package if none exists
INSERT INTO public.subscription_packages (name, description, price, duration_days, product_limit, is_active, is_trial, trial_days, features, sort_order)
SELECT '3-Day Free Trial', 'Full platform access for 3 days', 0, 3, 50, true, true, 3,
  '{"ai_agent":true,"ai_messenger":true,"pixel":true,"courier":true,"inventory":true,"coupons":true,"invoice":true,"analytics":true,"import_export":true,"bulk_actions":true,"staff":true,"customer_notes":true,"returns":true}'::jsonb,
  0
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_packages WHERE is_trial = true);
