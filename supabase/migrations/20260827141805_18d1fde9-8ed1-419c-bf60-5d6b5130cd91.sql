ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS business_hours text;

CREATE TABLE IF NOT EXISTS public.store_newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  email text NOT NULL,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, email)
);

GRANT SELECT, INSERT ON public.store_newsletter_subscribers TO anon;
GRANT SELECT, INSERT ON public.store_newsletter_subscribers TO authenticated;
GRANT ALL ON public.store_newsletter_subscribers TO service_role;

ALTER TABLE public.store_newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe to a store newsletter"
  ON public.store_newsletter_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Store owners can view their subscribers"
  ON public.store_newsletter_subscribers
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_newsletter_subscribers.store_id
      AND (s.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'))
  ));

CREATE OR REPLACE FUNCTION public.get_public_store_by_slug(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'name', s.name, 'description', s.description,
    'logo_url', s.logo_url,
    'name_logo_url', s.name_logo_url,
    'all_category_image_url', s.all_category_image_url,
    'icon_url', s.icon_url,
    'favicon_url', s.favicon_url,
    'use_icon_as_favicon', COALESCE(s.use_icon_as_favicon, true),
    'custom_favicon_url', s.custom_favicon_url,
    'phone', s.phone, 'whatsapp', s.whatsapp,
    'email', s.email,
    'facebook', s.facebook, 'instagram', s.instagram, 'youtube', s.youtube,
    'tiktok', s.tiktok, 'linkedin', s.linkedin, 'website', s.website,
    'address', s.address,
    'trade_license', s.trade_license,
    'business_hours', s.business_hours,
    'primary_color', s.primary_color, 'header_color', s.header_color,
    'title_bar_color', s.title_bar_color, 'footer_color', s.footer_color,
    'button_color', s.button_color, 'bkash_number', s.bkash_number,
    'nagad_number', s.nagad_number, 'status', s.status::text,
    'marketing', COALESCE(s.marketing, '{}'::jsonb) - 'fb_capi_token',
    'seo', s.seo, 'theme', s.theme, 'delivery', s.delivery,
    'payments_config', s.payments_config,
    'currency', s.currency, 'language', s.language, 'timezone', s.timezone,
    'storefront_lang_switcher', COALESCE(s.storefront_lang_switcher, true),
    'storefront_default_lang', COALESCE(s.storefront_default_lang, 'en'),
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
$function$;

REVOKE ALL ON FUNCTION public.get_public_store_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_store_by_slug(text) TO anon, authenticated;
