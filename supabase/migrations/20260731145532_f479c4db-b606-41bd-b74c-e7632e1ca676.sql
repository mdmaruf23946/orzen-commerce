REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, store_id, category_id, name, slug, description, short_description,
  price, old_price, primary_image_url, gallery, video_url,
  status, is_featured, stock, low_stock_threshold, total_sold, rating,
  brand, product_code, features, specifications, variants,
  warranty, return_policy, shipping_info,
  delivery_charge, delivery_time_days, related_product_ids,
  created_at, updated_at
) ON public.products TO anon;