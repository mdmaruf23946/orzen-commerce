CREATE OR REPLACE VIEW public.storefront_products
WITH (security_invoker = on) AS
SELECT p.id, p.store_id, p.category_id, p.name, p.slug, p.description, p.short_description,
       p.price, p.old_price, p.stock, p.status, p.primary_image_url, p.gallery, p.brand, p.sku,
       p.product_code, p.features, p.specifications, p.variants, p.video_url, p.warranty,
       p.return_policy, p.shipping_info, p.delivery_charge, p.delivery_time_days, p.rating,
       p.total_sold, p.related_product_ids, p.product_type, p.is_featured, p.meta,
       p.created_at, p.updated_at
FROM public.products p
WHERE p.status = 'active'::product_status
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p.store_id AND s.status = 'active');

REVOKE SELECT ON public.stores FROM anon;
GRANT SELECT (id, status) ON public.stores TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_store_active(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_active(uuid) TO service_role;
GRANT SELECT ON public.storefront_products TO anon, authenticated;
GRANT ALL ON public.storefront_products TO service_role;