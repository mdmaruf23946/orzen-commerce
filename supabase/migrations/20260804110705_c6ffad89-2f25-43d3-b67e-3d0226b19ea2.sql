REVOKE EXECUTE ON FUNCTION public.next_subscription_no(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.next_subscription_no(uuid) TO service_role;