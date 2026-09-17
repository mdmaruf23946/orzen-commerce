REVOKE ALL ON FUNCTION public.is_slug_taken(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_slug_taken(text) TO anon, authenticated, service_role;