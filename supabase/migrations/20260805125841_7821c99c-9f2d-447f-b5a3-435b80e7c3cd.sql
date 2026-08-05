-- 1) Products: restore public read for storefront, excluding internal cost_price
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, store_id, category_id, name, slug, description, price, old_price, stock, status,
  primary_image_url, gallery, created_at, updated_at, warranty, return_policy, shipping_info,
  low_stock_threshold, sku, is_featured, meta, brand, product_code, short_description,
  features, specifications, variants, video_url, delivery_charge, delivery_time_days,
  rating, total_sold, related_product_ids, product_type
) ON public.products TO anon;

-- 2) Lock down internal SECURITY DEFINER routines from API roles
REVOKE EXECUTE ON FUNCTION public.expire_trials() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._new_session_token(uuid, uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_no(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_subscription_no(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_store_template_for_seed() FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_store_subscription_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_custom_gateway_public(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_messenger_daily_stats(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_active_ads() FROM anon;