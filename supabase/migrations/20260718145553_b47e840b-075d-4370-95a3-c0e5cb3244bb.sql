
CREATE TABLE public.subscription_payment_providers (
  id text PRIMARY KEY,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT false,
  sandbox boolean NOT NULL DEFAULT true,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text,
  status_message text,
  latency_ms integer,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payment_providers TO authenticated;
GRANT ALL ON public.subscription_payment_providers TO service_role;
ALTER TABLE public.subscription_payment_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage providers" ON public.subscription_payment_providers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE UNIQUE INDEX one_active_provider ON public.subscription_payment_providers ((is_active)) WHERE is_active = true;
CREATE TRIGGER touch_spp_updated_at BEFORE UPDATE ON public.subscription_payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.subscription_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('percent','fixed')),
  value numeric NOT NULL CHECK (value >= 0),
  min_amount numeric NOT NULL DEFAULT 0,
  applies_to_packages uuid[] NOT NULL DEFAULT '{}',
  applies_to_cycles text[] NOT NULL DEFAULT '{}',
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_coupons TO authenticated;
GRANT ALL ON public.subscription_coupons TO service_role;
ALTER TABLE public.subscription_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage sub coupons" ON public.subscription_coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER touch_scoupons_updated_at BEFORE UPDATE ON public.subscription_coupons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text UNIQUE NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  package_id uuid REFERENCES public.subscription_packages(id) ON DELETE SET NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','3m','6m','yearly')),
  amount numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  coupon_id uuid REFERENCES public.subscription_coupons(id) ON DELETE SET NULL,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BDT',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded','cancelled')),
  pdf_path text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sinvoices_store ON public.subscription_invoices(store_id);
CREATE INDEX idx_sinvoices_user ON public.subscription_invoices(user_id);
CREATE INDEX idx_sinvoices_status ON public.subscription_invoices(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_invoices TO authenticated;
GRANT ALL ON public.subscription_invoices TO service_role;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads all invoices" ON public.subscription_invoices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Store owner reads own invoices" ON public.subscription_invoices FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER touch_sinvoices_updated_at BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.subscription_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.subscription_invoices(id) ON DELETE CASCADE,
  provider_id text REFERENCES public.subscription_payment_providers(id) ON DELETE SET NULL,
  provider_ref text,
  method text,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','pending','success','failed','cancelled')),
  sandbox boolean NOT NULL DEFAULT true,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);
CREATE INDEX idx_stx_provider_ref ON public.subscription_transactions(provider_id, provider_ref);
CREATE INDEX idx_stx_invoice ON public.subscription_transactions(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_transactions TO authenticated;
GRANT ALL ON public.subscription_transactions TO service_role;
ALTER TABLE public.subscription_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads all tx" ON public.subscription_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Store owner reads own tx" ON public.subscription_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subscription_invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));

CREATE TABLE public.subscription_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.subscription_coupons(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.subscription_invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount_off numeric NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, invoice_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_coupon_redemptions TO authenticated;
GRANT ALL ON public.subscription_coupon_redemptions TO service_role;
ALTER TABLE public.subscription_coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads all redemptions" ON public.subscription_coupon_redemptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "User reads own redemptions" ON public.subscription_coupon_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.validate_subscription_coupon(_code text, _package_id uuid, _cycle text, _amount numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; discount numeric := 0;
BEGIN
  SELECT * INTO c FROM public.subscription_coupons WHERE code = upper(_code) LIMIT 1;
  IF NOT FOUND OR NOT c.active THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid coupon'); END IF;
  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN RETURN jsonb_build_object('ok', false, 'error', 'Coupon not yet active'); END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'Coupon expired'); END IF;
  IF c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit THEN RETURN jsonb_build_object('ok', false, 'error', 'Usage limit reached'); END IF;
  IF _amount < COALESCE(c.min_amount, 0) THEN RETURN jsonb_build_object('ok', false, 'error', 'Minimum amount not met'); END IF;
  IF array_length(c.applies_to_packages, 1) IS NOT NULL AND NOT (_package_id = ANY(c.applies_to_packages)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Coupon not valid for this plan'); END IF;
  IF array_length(c.applies_to_cycles, 1) IS NOT NULL AND NOT (_cycle = ANY(c.applies_to_cycles)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Coupon not valid for this billing cycle'); END IF;
  IF c.type = 'percent' THEN discount := round(_amount * c.value / 100, 2);
  ELSE discount := least(c.value, _amount); END IF;
  RETURN jsonb_build_object('ok', true, 'couponId', c.id, 'code', c.code, 'type', c.type, 'discount', discount);
END $$;
REVOKE ALL ON FUNCTION public.validate_subscription_coupon(text, uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_subscription_coupon(text, uuid, text, numeric) TO authenticated;

CREATE POLICY "Owner reads subscription invoice files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'subscription-invoices' AND public.has_role(auth.uid(), 'owner'));

INSERT INTO public.subscription_payment_providers (id, label, enabled, sandbox) VALUES
  ('sslcommerz', 'SSLCommerz', false, true),
  ('bkash',      'bKash',      false, true),
  ('manual',     'Manual / Bank Transfer', false, false)
ON CONFLICT (id) DO NOTHING;
