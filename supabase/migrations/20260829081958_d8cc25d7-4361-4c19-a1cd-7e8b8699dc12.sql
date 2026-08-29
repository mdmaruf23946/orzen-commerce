CREATE OR REPLACE VIEW public.storefront_products
WITH (security_invoker = on) AS
SELECT id, store_id, category_id, name, slug, description, short_description,
       price, old_price, stock, status, primary_image_url, gallery, brand, sku,
       product_code, features, specifications, variants, video_url, warranty,
       return_policy, shipping_info, delivery_charge, delivery_time_days, rating,
       total_sold, related_product_ids, product_type, is_featured, meta,
       created_at, updated_at
FROM public.products
WHERE status = 'active'::product_status AND public.is_store_active(store_id);

REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (id, store_id, category_id, name, slug, description, short_description,
       price, old_price, stock, status, primary_image_url, gallery, brand, sku,
       product_code, features, specifications, variants, video_url, warranty,
       return_policy, shipping_info, delivery_charge, delivery_time_days, rating,
       total_sold, related_product_ids, product_type, is_featured, meta,
       created_at, updated_at) ON public.products TO anon, authenticated;
GRANT SELECT ON public.storefront_products TO anon, authenticated;
GRANT ALL ON public.storefront_products TO service_role;