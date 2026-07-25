
ALTER TABLE public.courier_providers
  ADD COLUMN IF NOT EXISTS dark_logo_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS docs_url text,
  ADD COLUMN IF NOT EXISTS support_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;

CREATE UNIQUE INDEX IF NOT EXISTS courier_providers_name_lower_key
  ON public.courier_providers (lower(name));

DROP FUNCTION IF EXISTS public.get_public_courier_providers();
CREATE OR REPLACE FUNCTION public.get_public_courier_providers()
 RETURNS TABLE(
   code text, name text, logo_url text, is_active boolean,
   brand_color text, secondary_color text, icon_bg_color text, description text,
   dark_logo_url text, favicon_url text,
   website_url text, docs_url text, support_url text,
   sort_order integer
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT code, name, logo_url, is_active,
         brand_color, secondary_color, icon_bg_color, description,
         dark_logo_url, favicon_url,
         website_url, docs_url, support_url,
         sort_order
    FROM public.courier_providers
   ORDER BY sort_order ASC NULLS LAST, name ASC;
$function$;
