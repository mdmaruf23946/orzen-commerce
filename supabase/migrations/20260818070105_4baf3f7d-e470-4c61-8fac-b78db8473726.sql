-- Restore anonymous storefront reads on products, but only for
-- customer-facing columns. cost_price and low_stock_threshold stay
-- unreachable for anonymous visitors (column-level privileges).
GRANT SELECT (
  id, store_id, category_id, name, slug, description, price, old_price, stock,
  status, primary_image_url, gallery, created_at, updated_at, warranty,
  return_policy, shipping_info, sku, is_featured, meta, brand, product_code,
  short_description, features, specifications, variants, video_url,
  delivery_charge, delivery_time_days, rating, total_sold,
  related_product_ids, product_type
) ON public.products TO anon;

CREATE POLICY "products public read active published"
  ON public.products FOR SELECT TO anon
  USING (is_store_active(store_id) AND status = 'active'::product_status);