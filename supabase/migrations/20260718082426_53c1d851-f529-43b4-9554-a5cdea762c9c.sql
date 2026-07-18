
CREATE TABLE public.fraud_settings (
  id text PRIMARY KEY DEFAULT 'global',
  enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'bd_courier',
  api_key text,
  api_secret text,
  enable_manual_check boolean NOT NULL DEFAULT true,
  enable_auto_check_before_courier boolean NOT NULL DEFAULT false,
  show_in_order_details boolean NOT NULL DEFAULT true,
  enable_analytics boolean NOT NULL DEFAULT true,
  thresholds jsonb NOT NULL DEFAULT '{"safe_max":10,"medium_max":30}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fraud_settings_singleton CHECK (id = 'global')
);
GRANT ALL ON public.fraud_settings TO service_role;
ALTER TABLE public.fraud_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads fraud settings" ON public.fraud_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner writes fraud settings" ON public.fraud_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

INSERT INTO public.fraud_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

CREATE TRIGGER trg_fraud_settings_touch
BEFORE UPDATE ON public.fraud_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DO $$ BEGIN
  CREATE TYPE public.fraud_risk AS ENUM ('safe','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.fraud_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  phone text NOT NULL,
  risk public.fraud_risk NOT NULL,
  score numeric,
  total_orders int NOT NULL DEFAULT 0,
  successful int NOT NULL DEFAULT 0,
  returned int NOT NULL DEFAULT 0,
  cancelled int NOT NULL DEFAULT 0,
  cod_success_rate numeric,
  last_delivery timestamptz,
  courier_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw jsonb,
  checked_by uuid,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fraud_checks_store_phone_uidx ON public.fraud_checks(store_id, phone);
CREATE INDEX fraud_checks_store_checked_idx ON public.fraud_checks(store_id, checked_at DESC);
CREATE INDEX fraud_checks_risk_idx ON public.fraud_checks(risk);

GRANT SELECT ON public.fraud_checks TO authenticated;
GRANT ALL ON public.fraud_checks TO service_role;
ALTER TABLE public.fraud_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners read own fraud checks" ON public.fraud_checks
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'owner'));

CREATE OR REPLACE FUNCTION public.get_fraud_public_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'enabled', COALESCE(enabled, false),
    'show_in_order_details', COALESCE(show_in_order_details, true),
    'enable_manual_check', COALESCE(enable_manual_check, true),
    'enable_auto_check_before_courier', COALESCE(enable_auto_check_before_courier, false)
  ) FROM public.fraud_settings WHERE id = 'global' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_fraud_public_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fraud_public_status() TO authenticated;

INSERT INTO public.platform_feature_flags (flag_key, label, description, enabled, category)
VALUES ('fraud_checker', 'Fraud Checker', 'Customer risk lookup powered by BD Courier', true, 'business')
ON CONFLICT (flag_key) DO NOTHING;
