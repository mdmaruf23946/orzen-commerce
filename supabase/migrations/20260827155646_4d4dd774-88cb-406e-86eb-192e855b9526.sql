CREATE POLICY "products public read active published"
ON public.products
FOR SELECT
TO anon
USING ((status = 'active'::public.product_status) AND public.is_store_active(store_id));
GRANT SELECT (id, store_id, category_id, name, slug, description, price, old_price, stock, status, primary_image_url, gallery, created_at, updated_at, warranty, return_policy, shipping_info, low_stock_threshold, sku, is_featured, meta, brand, product_code, short_description, features, specifications, variants, video_url, delivery_charge, delivery_time_days, rating, total_sold, related_product_ids, product_type)
ON public.products TO anon;
REVOKE SELECT (cost_price) ON public.products FROM anon;