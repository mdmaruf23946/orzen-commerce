
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS icon_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS use_icon_as_favicon boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_favicon_url text;

CREATE OR REPLACE FUNCTION public.get_public_store_by_slug(_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
