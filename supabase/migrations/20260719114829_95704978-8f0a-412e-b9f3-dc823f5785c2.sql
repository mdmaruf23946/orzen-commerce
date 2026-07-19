
-- Settings
CREATE TABLE public.store_duplicate_protection (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'block' CHECK (mode IN ('block','warn','off')),
  period_days int NOT NULL DEFAULT 7 CHECK (period_days IN (1,3,7,15,30)),
  rule_phone boolean NOT NULL DEFAULT true,
  rule_product boolean NOT NULL DEFAULT true,
  rule_fingerprint boolean NOT NULL DEFAULT false,
  rule_device boolean NOT NULL DEFAULT false,
  rule_customer boolean NOT NULL DEFAULT true,
  match_logic text NOT NULL DEFAULT 'any' CHECK (match_logic IN ('any','all')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_duplicate_protection TO authenticated;
GRANT ALL ON public.store_duplicate_protection TO service_role;
ALTER TABLE public.store_duplicate_protection ENABLE ROW LEVEL SECURITY;
CREATE POLICY dp_owner_all ON public.store_duplicate_protection FOR ALL TO authenticated
  USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_dp_updated_at BEFORE UPDATE ON public.store_duplicate_protection
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Whitelist
CREATE TABLE public.store_duplicate_whitelist_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.store_customers(id) ON DELETE CASCADE,
  phone text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (customer_id IS NOT NULL OR phone IS NOT NULL)
);
CREATE UNIQUE INDEX dp_wl_store_customer ON public.store_duplicate_whitelist_customers(store_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE UNIQUE INDEX dp_wl_store_phone ON public.store_duplicate_whitelist_customers(store_id, phone) WHERE phone IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_duplicate_whitelist_customers TO authenticated;
GRANT ALL ON public.store_duplicate_whitelist_customers TO service_role;
ALTER TABLE public.store_duplicate_whitelist_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY dp_wl_owner_all ON public.store_duplicate_whitelist_customers FOR ALL TO authenticated
  USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- Excluded products
CREATE TABLE public.store_duplicate_excluded_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_duplicate_excluded_products TO authenticated;
GRANT ALL ON public.store_duplicate_excluded_products TO service_role;
ALTER TABLE public.store_duplicate_excluded_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY dp_excl_owner_all ON public.store_duplicate_excluded_products FOR ALL TO authenticated
  USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- Blocked orders audit / queue
CREATE TABLE public.store_duplicate_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  matched_rules text[] NOT NULL DEFAULT '{}',
  matched_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  phone text,
  customer_id uuid REFERENCES public.store_customers(id) ON DELETE SET NULL,
  fingerprint text,
  device_id text,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'blocked' CHECK (status IN ('blocked','approved','dismissed','warned')),
  created_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dp_blocks_store_status ON public.store_duplicate_blocks(store_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_duplicate_blocks TO authenticated;
GRANT ALL ON public.store_duplicate_blocks TO service_role;
ALTER TABLE public.store_duplicate_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY dp_blocks_owner_all ON public.store_duplicate_blocks FOR ALL TO authenticated
  USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- Orders columns for fingerprint / device
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fingerprint text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS device_id text;

-- Indexes for fast duplicate lookups
CREATE INDEX IF NOT EXISTS orders_store_phone_created ON public.orders(store_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_store_customer_created ON public.orders(store_id, customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_store_fingerprint_created ON public.orders(store_id, fingerprint, created_at DESC) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_store_device_created ON public.orders(store_id, device_id, created_at DESC) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_items_product_id ON public.order_items(product_id);
