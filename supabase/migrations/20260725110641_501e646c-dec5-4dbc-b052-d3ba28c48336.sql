
-- 1) New store settings fields
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS youtube text,
  ADD COLUMN IF NOT EXISTS tiktok text,
  ADD COLUMN IF NOT EXISTS linkedin text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS trade_license text,
  ADD COLUMN IF NOT EXISTS tax_number text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BDT',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Dhaka',
  ADD COLUMN IF NOT EXISTS allow_guest_checkout boolean NOT NULL DEFAULT true;

-- 2) Delivery zones — remove public-column exposure, expose safe columns via RPC
DROP POLICY IF EXISTS "Public can view active zones of active stores" ON public.delivery_zones;

CREATE OR REPLACE FUNCTION public.get_public_delivery_zones(_store_id uuid)
RETURNS TABLE(id uuid, name text, charge numeric, eta text, is_default boolean, sort_order int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT z.id, z.name, z.charge, z.eta, z.is_default, z.sort_order
  FROM public.delivery_zones z
  JOIN public.stores s ON s.id = z.store_id
  WHERE z.store_id = _store_id
    AND z.is_active = true
    AND s.status = 'active'
  ORDER BY z.sort_order, z.name;
$$;

REVOKE ALL ON FUNCTION public.get_public_delivery_zones(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_delivery_zones(uuid) TO anon, authenticated;

-- 3) Extend public storefront RPC to expose new safe branding/contact fields
CREATE OR REPLACE FUNCTION public.get_public_store_by_slug(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'name', s.name, 'description', s.description,
    'logo_url', s.logo_url, 'phone', s.phone, 'whatsapp', s.whatsapp,
    'email', s.email,
    'facebook', s.facebook, 'instagram', s.instagram, 'youtube', s.youtube,
    'tiktok', s.tiktok, 'linkedin', s.linkedin, 'website', s.website,
    'address', s.address,
    'primary_color', s.primary_color, 'header_color', s.header_color,
    'title_bar_color', s.title_bar_color, 'footer_color', s.footer_color,
    'button_color', s.button_color, 'bkash_number', s.bkash_number,
    'nagad_number', s.nagad_number, 'status', s.status::text,
    'marketing', COALESCE(s.marketing, '{}'::jsonb) - 'fb_capi_token',
    'seo', s.seo, 'theme', s.theme, 'delivery', s.delivery,
    'payments_config', s.payments_config,
    'currency', s.currency, 'language', s.language, 'timezone', s.timezone,
    'require_customer_login', COALESCE(s.require_customer_login, false),
    'allow_guest_checkout', COALESCE(s.allow_guest_checkout, true)
  )
  FROM public.stores s
  WHERE s.slug = _slug AND s.status = 'active'
  LIMIT 1;
$$;
