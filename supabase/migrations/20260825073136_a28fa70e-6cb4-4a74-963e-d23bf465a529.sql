REVOKE EXECUTE ON FUNCTION public.staff_store_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_store_employee(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_store_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_store_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_store_employee(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_store_access(uuid) TO authenticated, service_role;