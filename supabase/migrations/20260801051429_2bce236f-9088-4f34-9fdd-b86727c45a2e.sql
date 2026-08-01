-- 1. Store mode
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS store_mode text NOT NULL DEFAULT 'physical';
DO $$ BEGIN
  ALTER TABLE public.stores ADD CONSTRAINT stores_store_mode_chk
    CHECK (store_mode IN ('physical','digital','hybrid'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Product type + digital payload
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS digital jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.products
   SET product_type = 'digital'
 WHERE lower(coalesce(meta->>'product_type','')) = 'digital'
   AND product_type <> 'digital';

DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_product_type_chk
    CHECK (product_type IN ('physical','digital'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT (product_type, digital) ON public.products TO anon, authenticated;

-- 3. Orders digital flag
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_digital boolean NOT NULL DEFAULT false;

-- 4. Product files
CREATE TABLE IF NOT EXISTS public.product_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL,
  storage_path text,
  external_url text,
  file_type text,
  file_size bigint,
  version text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_files_product_idx ON public.product_files(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_files TO authenticated;
GRANT ALL ON public.product_files TO service_role;
ALTER TABLE public.product_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner manages product files" ON public.product_files;
CREATE POLICY "owner manages product files" ON public.product_files
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));
DROP TRIGGER IF EXISTS product_files_touch ON public.product_files;
CREATE TRIGGER product_files_touch BEFORE UPDATE ON public.product_files
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 5. Order downloads (entitlements)
CREATE TABLE IF NOT EXISTS public.order_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_file_id uuid REFERENCES public.product_files(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.store_customers(id) ON DELETE SET NULL,
  customer_email text,
  product_name text NOT NULL,
  file_label text,
  version text,
  status text NOT NULL DEFAULT 'active',
  download_count integer NOT NULL DEFAULT 0,
  max_downloads integer,
  expires_at timestamptz,
  last_downloaded_at timestamptz,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS order_downloads_token_idx ON public.order_downloads(token);
CREATE INDEX IF NOT EXISTS order_downloads_order_idx ON public.order_downloads(order_id);
CREATE INDEX IF NOT EXISTS order_downloads_customer_idx ON public.order_downloads(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_downloads TO authenticated;
GRANT ALL ON public.order_downloads TO service_role;
ALTER TABLE public.order_downloads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner manages order downloads" ON public.order_downloads;
CREATE POLICY "owner manages order downloads" ON public.order_downloads
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));
DROP TRIGGER IF EXISTS order_downloads_touch ON public.order_downloads;
CREATE TRIGGER order_downloads_touch BEFORE UPDATE ON public.order_downloads
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 6. License keys
CREATE TABLE IF NOT EXISTS public.license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.store_customers(id) ON DELETE SET NULL,
  key_value text NOT NULL,
  kind text NOT NULL DEFAULT 'license',
  status text NOT NULL DEFAULT 'available',
  assigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS license_keys_product_idx ON public.license_keys(product_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_keys TO authenticated;
GRANT ALL ON public.license_keys TO service_role;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner manages license keys" ON public.license_keys;
CREATE POLICY "owner manages license keys" ON public.license_keys
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));
DROP TRIGGER IF EXISTS license_keys_touch ON public.license_keys;
CREATE TRIGGER license_keys_touch BEFORE UPDATE ON public.license_keys
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 7. Platform-level digital settings
CREATE TABLE IF NOT EXISTS public.platform_digital_settings (
  id text PRIMARY KEY DEFAULT 'global',
  license_system_enabled boolean NOT NULL DEFAULT true,
  max_file_mb integer NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.platform_digital_settings(id) VALUES ('global') ON CONFLICT DO NOTHING;
GRANT SELECT, INSERT, UPDATE ON public.platform_digital_settings TO authenticated;
GRANT ALL ON public.platform_digital_settings TO service_role;
ALTER TABLE public.platform_digital_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform owner manages digital settings" ON public.platform_digital_settings;
CREATE POLICY "platform owner manages digital settings" ON public.platform_digital_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
DROP TRIGGER IF EXISTS platform_digital_settings_touch ON public.platform_digital_settings;
CREATE TRIGGER platform_digital_settings_touch BEFORE UPDATE ON public.platform_digital_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_digital_public_settings()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'license_system_enabled', COALESCE(license_system_enabled, true),
    'max_file_mb', COALESCE(max_file_mb, 200)
  ) FROM public.platform_digital_settings WHERE id = 'global' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_digital_public_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_digital_public_settings() TO authenticated, service_role;

-- Expose store_mode publicly through the storefront RPC
CREATE OR REPLACE FUNCTION public.get_public_store_by_slug(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'name', s.name, 'description', s.description,
    'logo_url', s.logo_url,
    'icon_url', s.icon_url,
    'favicon_url', s.favicon_url,
    'use_icon_as_favicon', COALESCE(s.use_icon_as_favicon, true),
    'custom_favicon_url', s.custom_favicon_url,
    'phone', s.phone, 'whatsapp', s.whatsapp,
    'email', s.email,
    'facebook', s.facebook, 'instagram', s.instagram, 'youtube', s.youtube,
    'tiktok', s.tiktok, 'linkedin', s.linkedin, 'website', s.website,
    'address', s.address,
    'primary_color', s.primary_color, 'header_color', s.header_color,
    'title_bar_color', s.title_bar_color, 'footer_color', s.footer_color,
    'button_color', s.button_color, 'bkash_number', s.bkash_number,
    'nagad_number', s.nagad_number, 'status', s.status::text,
    'store_mode', COALESCE(s.store_mode, 'physical'),
    'marketing', COALESCE(s.marketing, '{}'::jsonb) - 'fb_capi_token',
    'seo', s.seo, 'theme', s.theme, 'delivery', s.delivery,
    'payments_config', s.payments_config,
    'currency', s.currency, 'language', s.language, 'timezone', s.timezone,
    'require_customer_login', COALESCE(s.require_customer_login, false),
    'allow_guest_checkout', COALESCE(s.allow_guest_checkout, true),
    'theme_id', s.theme_id,
    'theme_overrides', COALESCE(s.theme_overrides, '{}'::jsonb),
    'theme_definition', COALESCE(t.definition, '{}'::jsonb),
    'theme_locked', COALESCE(t.locked, '{}'::jsonb),
    'theme_name', t.name
  )
  FROM public.stores s
  LEFT JOIN public.store_themes t ON t.id = s.theme_id
  WHERE s.slug = _slug AND s.status = 'active'
  LIMIT 1;
$$;