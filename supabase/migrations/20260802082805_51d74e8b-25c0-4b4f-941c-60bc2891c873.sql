
CREATE TABLE public.digital_licenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  license_key text not null,
  license_type text not null default 'personal',
  max_activations integer,
  activation_count integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.digital_licenses TO authenticated;
GRANT ALL ON public.digital_licenses TO service_role;
ALTER TABLE public.digital_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read licenses" ON public.digital_licenses FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = digital_licenses.store_id AND s.owner_user_id = auth.uid()));

CREATE TABLE public.digital_entitlements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid references public.store_customers(id) on delete set null,
  customer_phone text,
  customer_email text,
  access_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'locked',
  max_downloads integer,
  download_count integer not null default 0,
  max_devices integer,
  max_ips integer,
  expires_at timestamptz,
  version text,
  license_id uuid references public.digital_licenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE INDEX digital_entitlements_order_idx ON public.digital_entitlements(order_id);
CREATE INDEX digital_entitlements_customer_idx ON public.digital_entitlements(customer_id);
GRANT SELECT ON public.digital_entitlements TO authenticated;
GRANT ALL ON public.digital_entitlements TO service_role;
ALTER TABLE public.digital_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read entitlements" ON public.digital_entitlements FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = digital_entitlements.store_id AND s.owner_user_id = auth.uid()));

CREATE TABLE public.digital_downloads (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  entitlement_id uuid not null references public.digital_entitlements(id) on delete cascade,
  file_path text,
  ip text,
  device_id text,
  user_agent text,
  created_at timestamptz not null default now()
);
CREATE INDEX digital_downloads_entitlement_idx ON public.digital_downloads(entitlement_id);
GRANT SELECT ON public.digital_downloads TO authenticated;
GRANT ALL ON public.digital_downloads TO service_role;
ALTER TABLE public.digital_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read downloads" ON public.digital_downloads FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = digital_downloads.store_id AND s.owner_user_id = auth.uid()));

CREATE TRIGGER digital_entitlements_updated_at BEFORE UPDATE ON public.digital_entitlements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER digital_licenses_updated_at BEFORE UPDATE ON public.digital_licenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
