CREATE TABLE public.call_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'device',
  credentials_encrypted text,
  credentials_preview text,
  caller_id text,
  status text NOT NULL DEFAULT 'not_connected',
  last_error text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_provider_settings TO authenticated;
GRANT ALL ON public.call_provider_settings TO service_role;
ALTER TABLE public.call_provider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage call provider settings"
  ON public.call_provider_settings FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.store_customers(id) ON DELETE SET NULL,
  customer_name text,
  phone text NOT NULL,
  agent_id uuid,
  agent_email text,
  provider text NOT NULL DEFAULT 'device',
  provider_call_sid text,
  direction text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'calling',
  duration_sec integer NOT NULL DEFAULT 0,
  result text,
  note text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage calls"
  ON public.calls FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE INDEX calls_store_created_idx ON public.calls (store_id, created_at DESC);
CREATE INDEX calls_order_idx ON public.calls (order_id);
CREATE INDEX calls_customer_idx ON public.calls (customer_id);
CREATE UNIQUE INDEX calls_provider_sid_idx ON public.calls (provider_call_sid) WHERE provider_call_sid IS NOT NULL;

CREATE TRIGGER call_provider_settings_updated_at BEFORE UPDATE ON public.call_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER calls_updated_at BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();