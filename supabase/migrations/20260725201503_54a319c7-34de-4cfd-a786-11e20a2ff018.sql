
-- Revoke blanket anon SELECT and re-grant only shopper-safe columns.
REVOKE SELECT ON public.products FROM anon;

GRANT SELECT (
  id, store_id, category_id, name, slug, description, price, old_price, stock, status,
  primary_image_url, gallery, created_at, updated_at, warranty, return_policy, shipping_info,
  low_stock_threshold, sku, is_featured, brand, product_code, short_description, features,
  specifications, variants, video_url, delivery_charge, delivery_time_days, rating, total_sold,
  related_product_ids
) ON public.products TO anon;

-- Authenticated (owners) and service_role keep full access as before.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
