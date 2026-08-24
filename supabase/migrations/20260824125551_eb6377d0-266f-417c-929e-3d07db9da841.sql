-- Revoke direct API access to SECURITY DEFINER functions that are only ever
-- invoked by trusted server-side code (service role) or are unused.
REVOKE ALL ON FUNCTION public.get_public_payment_gateways() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_subscription_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_customer_subscriptions(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_subscription_coupon(text, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_custom_gateway_public(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_store_subscription_public_settings(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_payment_gateways() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_subscription_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_subscriptions(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_subscription_coupon(text, uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_custom_gateway_public(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_store_subscription_public_settings(uuid) TO service_role;