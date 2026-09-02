ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS twitter text,
  ADD COLUMN IF NOT EXISTS pinterest text,
  ADD COLUMN IF NOT EXISTS snapchat text,
  ADD COLUMN IF NOT EXISTS threads text;

CREATE OR REPLACE FUNCTION public.get_public_landing_page(_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', lp.id,
    'store_id', lp.store_id,
    'slug', lp.slug,
    'title', lp.title,
    'content', lp.content,
    'theme', lp.theme,
    'design_code', lp.design_code,
    'form_config', lp.form_config,
    'seo', lp.seo,
    'product', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'price', p.price,
      'old_price', p.old_price,
      'stock', p.stock,
      'status', p.status,
      'primary_image_url', p.primary_image_url,
      'gallery', p.gallery
    ) END,
    'store', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'slug', s.slug,
      'logo_url', s.logo_url,
      'name_logo_url', s.name_logo_url,
      'description', s.description,
      'phone', s.phone,
      'whatsapp', s.whatsapp,
      'email', s.email,
      'address', s.address,
      'website', s.website,
      'business_hours', s.business_hours,
      'trade_license', s.trade_license,
      'facebook', s.facebook,
      'instagram', s.instagram,
      'youtube', s.youtube,
      'tiktok', s.tiktok,
      'linkedin', s.linkedin,
      'telegram', s.telegram,
      'messenger', s.messenger,
      'twitter', s.twitter,
      'pinterest', s.pinterest,
      'snapchat', s.snapchat,
      'threads', s.threads
    ),
    'store_pages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', sp.page_key, 'title', sp.title) ORDER BY sp.page_key)
      FROM public.store_pages sp
      WHERE sp.store_id = s.id AND sp.is_published = true
    ), '[]'::jsonb)
  )
  FROM public.landing_pages lp
  JOIN public.stores s ON s.id = lp.store_id
  LEFT JOIN public.products p ON p.id = lp.product_id
  WHERE lp.slug = lower(_slug)
    AND lp.status = 'published'
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_landing_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_landing_page(text) TO anon, authenticated, service_role;