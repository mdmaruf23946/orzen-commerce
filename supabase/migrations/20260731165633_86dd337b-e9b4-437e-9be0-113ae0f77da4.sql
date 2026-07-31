-- 1) Product column-level exposure: give anon only storefront-safe columns
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, store_id, category_id, name, slug, description, short_description,
  price, old_price, stock, status, primary_image_url, gallery,
  created_at, updated_at, warranty, return_policy, shipping_info,
  low_stock_threshold, is_featured, brand, product_code,
  features, specifications, variants, video_url,
  delivery_charge, delivery_time_days, rating, total_sold, related_product_ids
) ON public.products TO anon;

-- 2) Internal SECURITY DEFINER helpers should not be callable through the API
REVOKE EXECUTE ON FUNCTION public.is_store_active(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_store_subscription_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_fraud_public_status() FROM anon;
