
-- Platform-managed provider catalog (Winner Admin controls what's available)
CREATE TABLE public.platform_payment_gateways (
  id text PRIMARY KEY,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  logo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_payment_gateways TO authenticated;
GRANT ALL ON public.platform_payment_gateways TO service_role;
ALTER TABLE public.platform_payment_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read enabled providers" ON public.platform_payment_gateways
  FOR SELECT TO authenticated USING (enabled = true OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "owner manage providers" ON public.platform_payment_gateways
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER trg_ppg_touch BEFORE UPDATE ON public.platform_payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Per-store connections
CREATE TABLE public.store_payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider_id text NOT NULL REFERENCES public.platform_payment_gateways(id) ON DELETE CASCADE,
  credentials_ciphertext text,
  credentials_preview text,
  sandbox boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'untested',
  last_tested_at timestamptz,
  last_test_result jsonb,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, provider_id)
);
CREATE UNIQUE INDEX store_payment_gateways_one_active
  ON public.store_payment_gateways(store_id) WHERE is_active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_payment_gateways TO authenticated;
GRANT ALL ON public.store_payment_gateways TO service_role;
ALTER TABLE public.store_payment_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store owner manages own gateways" ON public.store_payment_gateways
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_spg_touch BEFORE UPDATE ON public.store_payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Seed catalog with the modular providers
INSERT INTO public.platform_payment_gateways(id, label, enabled, sort_order) VALUES
  ('sslcommerz', 'SSLCommerz', true, 10),
  ('shurjopay', 'ShurjoPay', true, 20),
  ('amarpay', 'AmarPay', true, 30),
  ('portwallet', 'PortWallet', true, 40),
  ('stripe', 'Stripe', true, 50),
  ('paypal', 'PayPal', true, 60),
  ('manual', 'Manual / Bank Transfer', false, 90)
ON CONFLICT (id) DO NOTHING;

-- Helper RPC: returns the active gateway's public metadata for a store (no secrets)
CREATE OR REPLACE FUNCTION public.get_active_store_gateway_public(_store_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'provider_id', g.provider_id,
    'label', p.label,
    'sandbox', g.sandbox
  )
  FROM public.store_payment_gateways g
  JOIN public.platform_payment_gateways p ON p.id = g.provider_id
  WHERE g.store_id = _store_id
    AND g.is_active = true
    AND g.enabled = true
    AND g.status = 'connected'
    AND p.enabled = true
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_active_store_gateway_public(uuid) TO anon, authenticated;
