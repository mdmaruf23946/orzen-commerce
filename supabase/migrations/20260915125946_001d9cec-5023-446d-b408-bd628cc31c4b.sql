-- 1) Public product reads go through the curated view only
ALTER VIEW public.storefront_products SET (security_invoker = off);
GRANT SELECT ON public.storefront_products TO anon, authenticated;

DROP POLICY IF EXISTS "products public read storefront fields" ON public.products;
REVOKE ALL ON public.products FROM anon;

-- 2) SECURITY DEFINER functions: no implicit PUBLIC execute; explicit grants only
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Public storefront / platform RPCs (unauthenticated visitors + signed-in users)
GRANT EXECUTE ON FUNCTION
  public.get_active_store_gateway_public(uuid),
  public.get_custom_gateway_public(uuid),
  public.get_platform_branding(),
  public.get_platform_footer(),
  public.get_product_reviews(uuid),
  public.get_public_delivery_zones(uuid),
  public.get_public_landing_page(text),
  public.get_public_order(uuid),
  public.get_public_return_settings(uuid),
  public.get_public_service_order(uuid),
  public.get_public_store_by_slug(text),
  public.get_public_subscription_order(uuid),
  public.get_store_bestsellers(uuid, integer),
  public.get_store_legal_page(text, text),
  public.get_store_page(text, text),
  public.get_store_subscription_public_settings(uuid),
  public.is_store_active(uuid),
  public.landing_public_host(text),
  public.list_store_pages_public(text),
  public.platform_routing_hosts(),
  public.resolve_domain(text),
  public.resolve_host_kind(text),
  public.submit_product_review(uuid, uuid, smallint, text, text, text, text),
  public.touch_landing_activity(uuid, boolean),
  public.validate_coupon(uuid, text, numeric)
TO anon, authenticated;

-- Signed-in only helpers (each enforces its own tenant checks)
GRANT EXECUTE ON FUNCTION
  public.get_billing_discounts(),
  public.get_fraud_public_status(),
  public.get_messenger_daily_stats(uuid),
  public.get_my_active_ads(),
  public.get_public_courier_providers(),
  public.get_store_template_for_seed(),
  public.has_role(uuid, public.app_role),
  public.has_store_access(uuid),
  public.is_landing_slug_taken(text),
  public.is_slug_taken(text),
  public.is_store_employee(uuid),
  public.is_store_owner(uuid),
  public.list_ai_call_tones_public(),
  public.refresh_store_subscription_status(uuid),
  public.staff_store_id(uuid),
  public.validate_subscription_coupon(text, uuid, text, numeric),
  public.domain_token_exists(text)
TO authenticated;
