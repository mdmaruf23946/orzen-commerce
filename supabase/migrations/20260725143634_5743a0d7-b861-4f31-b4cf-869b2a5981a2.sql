
ALTER TABLE public.courier_providers ADD COLUMN IF NOT EXISTS logo_url text;

CREATE OR REPLACE FUNCTION public.get_public_courier_providers()
RETURNS TABLE(code text, name text, logo_url text, is_active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT code, name, logo_url, is_active
    FROM public.courier_providers
   ORDER BY name;
$$;

REVOKE ALL ON FUNCTION public.get_public_courier_providers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_courier_providers() TO authenticated;
