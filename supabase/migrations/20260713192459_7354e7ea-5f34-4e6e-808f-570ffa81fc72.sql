CREATE OR REPLACE FUNCTION public.is_slug_taken(_slug text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores WHERE slug = lower(_slug))
$$;

GRANT EXECUTE ON FUNCTION public.is_slug_taken(text) TO anon, authenticated;