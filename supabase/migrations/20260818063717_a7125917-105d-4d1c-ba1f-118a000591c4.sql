-- 1) Internal/service-role-only SECURITY DEFINER functions: remove public EXECUTE
REVOKE EXECUTE ON FUNCTION public.customer_signup(uuid, text, text, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.customer_login(uuid, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.customer_logout(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.customer_from_token(text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.customer_update_profile(text, uuid, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.customer_change_password(text, uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.customer_create_return_v2(text, uuid, uuid, text, text, text, text, jsonb, jsonb, text[], jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.customer_list_returns_v2(text, uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_customer_subscriptions(text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_store_subscription_status(uuid) FROM anon;

-- 2) products: cost_price must never be reachable by anonymous visitors
REVOKE ALL ON TABLE public.products FROM anon;

-- 3) store_customer_addresses: owners may remove their own store's addresses
DROP POLICY IF EXISTS "Store owners delete customer addresses" ON public.store_customer_addresses;
CREATE POLICY "Store owners delete customer addresses"
ON public.store_customer_addresses FOR DELETE TO authenticated
USING (public.is_store_owner(store_id));
GRANT DELETE ON public.store_customer_addresses TO authenticated;

-- 4) digital_downloads stay read-only for owners; writes only via backend
REVOKE INSERT, UPDATE, DELETE ON TABLE public.digital_downloads FROM anon, authenticated;
GRANT SELECT ON TABLE public.digital_downloads TO authenticated;
GRANT ALL ON TABLE public.digital_downloads TO service_role;

-- 5) realtime-published log tables: no anonymous access at all
REVOKE ALL ON TABLE public.landing_page_logs FROM anon;
REVOKE ALL ON TABLE public.payment_webhook_events FROM anon;
GRANT ALL ON TABLE public.landing_page_logs TO service_role;
GRANT ALL ON TABLE public.payment_webhook_events TO service_role;