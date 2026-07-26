-- Orders: additive source/tracking columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'store',
  ADD COLUMN IF NOT EXISTS landing_page_connection_id uuid,
  ADD COLUMN IF NOT EXISTS external_order_id text,
  ADD COLUMN IF NOT EXISTS landing_page_url text,
  ADD COLUMN IF NOT EXISTS utm jsonb,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Connections
CREATE TABLE IF NOT EXISTS public.landing_page_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  landing_page_name text,
  url text,
  description text,
  platform text NOT NULL DEFAULT 'custom',
  method text NOT NULL DEFAULT 'webhook',
  status text NOT NULL DEFAULT 'active',
  default_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  orders_received bigint NOT NULL DEFAULT 0,
  failed_count bigint NOT NULL DEFAULT 0,
  last_order_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lpc_store ON public.landing_page_connections(store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_page_connections TO authenticated;
GRANT ALL ON public.landing_page_connections TO service_role;
ALTER TABLE public.landing_page_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages lp connections" ON public.landing_page_connections
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

-- Credentials
CREATE TABLE IF NOT EXISTS public.landing_page_credentials (
  connection_id uuid PRIMARY KEY REFERENCES public.landing_page_connections(id) ON DELETE CASCADE,
  webhook_secret_enc text,
  api_key_hash text,
  api_key_last4 text,
  api_secret_enc text,
  rotated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_page_credentials TO authenticated;
GRANT ALL ON public.landing_page_credentials TO service_role;
ALTER TABLE public.landing_page_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages lp credentials" ON public.landing_page_credentials
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.landing_page_connections c WHERE c.id = connection_id AND public.is_store_owner(c.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.landing_page_connections c WHERE c.id = connection_id AND public.is_store_owner(c.store_id)));

-- Product map
CREATE TABLE IF NOT EXISTS public.landing_page_product_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.landing_page_connections(id) ON DELETE CASCADE,
  external_id text,
  external_sku text,
  store_product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  qty_multiplier numeric NOT NULL DEFAULT 1,
  variant_map jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lpm_conn ON public.landing_page_product_map(connection_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_page_product_map TO authenticated;
GRANT ALL ON public.landing_page_product_map TO service_role;
ALTER TABLE public.landing_page_product_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages lp product map" ON public.landing_page_product_map
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.landing_page_connections c WHERE c.id = connection_id AND public.is_store_owner(c.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.landing_page_connections c WHERE c.id = connection_id AND public.is_store_owner(c.store_id)));

-- Field map
CREATE TABLE IF NOT EXISTS public.landing_page_field_map (
  connection_id uuid PRIMARY KEY REFERENCES public.landing_page_connections(id) ON DELETE CASCADE,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_page_field_map TO authenticated;
GRANT ALL ON public.landing_page_field_map TO service_role;
ALTER TABLE public.landing_page_field_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages lp field map" ON public.landing_page_field_map
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.landing_page_connections c WHERE c.id = connection_id AND public.is_store_owner(c.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.landing_page_connections c WHERE c.id = connection_id AND public.is_store_owner(c.store_id)));

-- Logs
CREATE TABLE IF NOT EXISTS public.landing_page_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.landing_page_connections(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  external_order_id text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  request_hash text,
  ip text,
  ua text,
  request_snippet text,
  response_snippet text,
  error text,
  processing_ms integer
);
CREATE INDEX IF NOT EXISTS idx_lpl_conn_time ON public.landing_page_logs(connection_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_lpl_store_time ON public.landing_page_logs(store_id, received_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_page_logs TO authenticated;
GRANT ALL ON public.landing_page_logs TO service_role;
ALTER TABLE public.landing_page_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads lp logs" ON public.landing_page_logs
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

-- Idempotency: orders unique on (connection, external_order_id)
CREATE UNIQUE INDEX IF NOT EXISTS orders_lp_external_uniq
  ON public.orders(landing_page_connection_id, external_order_id)
  WHERE landing_page_connection_id IS NOT NULL AND external_order_id IS NOT NULL;

-- updated_at trigger for connections
DROP TRIGGER IF EXISTS trg_lpc_touch ON public.landing_page_connections;
CREATE TRIGGER trg_lpc_touch BEFORE UPDATE ON public.landing_page_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();