DROP POLICY IF EXISTS "stores public active check" ON public.stores;

-- Anonymous storefront visitors may see an active store, but only through a
-- safe column set. Legal/financial identifiers stay owner/employee-only.
CREATE POLICY "stores anon public fields"
ON public.stores FOR SELECT
TO anon
USING (status = 'active');

REVOKE SELECT ON public.stores FROM anon;
GRANT SELECT (
  id, slug, name, description, logo_url, phone, whatsapp, facebook, address,
  primary_color, status, header_color, title_bar_color, footer_color, button_color,
  seo, delivery, theme, require_customer_login, email, instagram, youtube, tiktok,
  linkedin, website, currency, language, timezone, allow_guest_checkout, branding,
  icon_url, favicon_url, use_icon_as_favicon, custom_favicon_url, theme_id,
  theme_overrides, name_logo_url, all_category_image_url, storefront_lang_switcher,
  storefront_default_lang, business_hours, messenger, telegram, twitter, pinterest,
  snapchat, threads, created_at, updated_at
) ON public.stores TO anon;

COMMENT ON TABLE public.stores IS
  'Anonymous visitors can read only public storefront columns of active stores (column-level grant). trade_license, tax_number, merchant_code, bkash_number, nagad_number, owner_name, business_name, payments_config, marketing, notifications and similar remain restricted to the store owner/employees and server-side privileged code.';