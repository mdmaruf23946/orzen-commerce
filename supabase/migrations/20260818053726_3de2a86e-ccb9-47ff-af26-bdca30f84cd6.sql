-- Customer credentials & sessions: backend-only, no direct client access
REVOKE ALL ON public.store_customer_credentials FROM anon, authenticated;
REVOKE ALL ON public.store_customer_sessions FROM anon, authenticated;
GRANT ALL ON public.store_customer_credentials TO service_role;
GRANT ALL ON public.store_customer_sessions TO service_role;
ALTER TABLE public.store_customer_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_customer_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_customer_sessions FORCE ROW LEVEL SECURITY;

-- Digital download logs: owner read only, writes via backend only
REVOKE ALL ON public.digital_downloads FROM anon, authenticated;
GRANT SELECT ON public.digital_downloads TO authenticated;
GRANT ALL ON public.digital_downloads TO service_role;

-- Service order files: owner read only, writes via backend only
REVOKE ALL ON public.service_order_files FROM anon, authenticated;
GRANT SELECT ON public.service_order_files TO authenticated;
GRANT ALL ON public.service_order_files TO service_role;