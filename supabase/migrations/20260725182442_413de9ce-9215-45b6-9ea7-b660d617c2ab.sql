
ALTER TABLE public.platform_payment_gateways
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS secondary_color TEXT,
  ADD COLUMN IF NOT EXISTS icon_bg_color TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.courier_providers
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS secondary_color TEXT,
  ADD COLUMN IF NOT EXISTS icon_bg_color TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Extend courier public RPC
DROP FUNCTION IF EXISTS public.get_public_courier_providers();
CREATE OR REPLACE FUNCTION public.get_public_courier_providers()
 RETURNS TABLE(code text, name text, logo_url text, is_active boolean, brand_color text, secondary_color text, icon_bg_color text, description text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT code, name, logo_url, is_active, brand_color, secondary_color, icon_bg_color, description
    FROM public.courier_providers
   ORDER BY name;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_courier_providers() TO anon, authenticated;

-- New payment gateways public RPC
CREATE OR REPLACE FUNCTION public.get_public_payment_gateways()
 RETURNS TABLE(id text, label text, logo_url text, brand_color text, secondary_color text, icon_bg_color text, description text, enabled boolean, sort_order int)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, label, logo_url, brand_color, secondary_color, icon_bg_color, description, enabled, sort_order
    FROM public.platform_payment_gateways
   WHERE enabled = true
   ORDER BY sort_order, label;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_payment_gateways() TO anon, authenticated;
