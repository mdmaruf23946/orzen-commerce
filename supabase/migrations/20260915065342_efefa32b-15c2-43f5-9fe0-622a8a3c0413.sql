REVOKE ALL ON public.store_customer_credentials FROM anon, authenticated;
REVOKE ALL ON public.store_customer_sessions FROM anon, authenticated;
REVOKE ALL ON public.store_customer_reset_tokens FROM anon, authenticated;
REVOKE ALL ON public.store_auth_attempts FROM anon, authenticated;

ALTER TABLE public.store_customer_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_customer_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_customer_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_customer_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_customer_reset_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_auth_attempts FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE public.store_customer_credentials IS 'Fail-closed: no Data API grants and no RLS policies. Access only through SECURITY DEFINER auth functions (customer_login, customer_signup, customer_change_password, customer_reset_password). Never add anon/authenticated SELECT here - it would expose password hashes.';
COMMENT ON TABLE public.store_customer_sessions IS 'Fail-closed: no Data API grants/policies. Session tokens are only read/written by SECURITY DEFINER auth functions.';
COMMENT ON TABLE public.store_customer_reset_tokens IS 'Fail-closed: no Data API grants/policies. Reset tokens only handled by SECURITY DEFINER auth functions.';
COMMENT ON TABLE public.store_auth_attempts IS 'Fail-closed: no Data API grants/policies. Login throttling data only written by SECURITY DEFINER auth functions.';