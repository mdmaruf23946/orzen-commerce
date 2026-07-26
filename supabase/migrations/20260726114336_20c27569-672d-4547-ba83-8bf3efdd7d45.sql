ALTER TABLE public.courier_providers ADD COLUMN IF NOT EXISTS wordmark_url text;

DROP FUNCTION IF EXISTS public.get_public_courier_providers();

CREATE OR REPLACE FUNCTION public.get_public_courier_providers()
RETURNS TABLE (
  code text,
  name text,
  description text,
  logo_url text,
  dark_logo_url text,
  favicon_url text,
  wordmark_url text,
  brand_color text,
  secondary_color text,
  icon_bg_color text,
  website_url text,
  docs_url text,
  support_url text,
  sort_order integer,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    code, name, description,
    logo_url, dark_logo_url, favicon_url, wordmark_url,
    brand_color, secondary_color, icon_bg_color,
    website_url, docs_url, support_url,
    sort_order, is_active
  FROM public.courier_providers
  WHERE is_active = true
  ORDER BY sort_order NULLS LAST, name;
$$;

REVOKE ALL ON FUNCTION public.get_public_courier_providers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_courier_providers() TO authenticated;