GRANT EXECUTE ON FUNCTION public.is_slug_taken(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_host_kind(text) TO anon, authenticated, service_role;