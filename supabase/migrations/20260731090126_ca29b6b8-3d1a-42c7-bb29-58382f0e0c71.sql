-- 1) Column-level protection for products (cost_price, low_stock_threshold, internal fields)
DROP POLICY IF EXISTS "products public read active stores" ON public.products;
CREATE POLICY "products public read active stores"
  ON public.products FOR SELECT TO anon
  USING (public.is_store_active(store_id));

REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, store_id, category_id, name, slug, description, price, old_price, stock, status,
  primary_image_url, gallery, created_at, updated_at, warranty, return_policy, shipping_info,
  sku, is_featured, meta, brand, product_code, short_description, features, specifications,
  variants, video_url, delivery_charge, delivery_time_days, rating, total_sold, related_product_ids
) ON public.products TO anon;

-- 2) Revoke EXECUTE on internal trigger / maintenance functions
REVOKE ALL ON FUNCTION public.enqueue_order_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_invoice_template_single_default() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_low_stock_check() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_stores_default_invoice_settings() FROM PUBLIC, anon, authenticated;

-- 3) Tighten broad PUBLIC grants on definer RPCs to the exact roles that need them
REVOKE ALL ON FUNCTION public.customer_signup(uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_signup(uuid, text, text, text, text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.customer_login(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_login(uuid, text, text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.customer_change_password(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_change_password(text, uuid, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_payment_gateways() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_payment_gateways() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_active_store_gateway_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_store_gateway_public(uuid) TO anon, authenticated;

-- 4) Admin-only RPCs should not be callable anonymously
REVOKE EXECUTE ON FUNCTION public.get_messenger_daily_stats(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_subscription_coupon(text, uuid, text, numeric) FROM anon;