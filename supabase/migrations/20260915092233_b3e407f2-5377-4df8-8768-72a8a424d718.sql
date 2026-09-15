DROP VIEW IF EXISTS public.storefront_products;

CREATE VIEW public.storefront_products
WITH (security_invoker = on) AS
SELECT
  p.id, p.store_id, p.category_id, p.name, p.slug, p.description, p.short_description,
  p.price, p.old_price, p.stock, p.status, p.primary_image_url, p.gallery, p.brand, p.sku,
  p.features, p.specifications, p.variants, p.video_url, p.warranty, p.return_policy,
  p.shipping_info, p.delivery_charge, p.delivery_time_days, p.rating, p.total_sold,
  p.related_product_ids, p.product_type, p.is_featured, p.meta, p.created_at, p.updated_at
FROM public.products p
WHERE p.status = 'active'::product_status
  AND public.is_store_active(p.store_id);

GRANT SELECT ON public.storefront_products TO anon, authenticated;

-- Column-scoped public read access on the base table (no cost_price / product_code)
CREATE POLICY "products public read storefront fields"
ON public.products
FOR SELECT
TO anon
USING (status = 'active'::product_status AND public.is_store_active(store_id));

GRANT SELECT (
  id, store_id, category_id, name, slug, description, short_description,
  price, old_price, stock, status, primary_image_url, gallery, brand, sku,
  features, specifications, variants, video_url, warranty, return_policy,
  shipping_info, delivery_charge, delivery_time_days, rating, total_sold,
  related_product_ids, product_type, is_featured, meta, created_at, updated_at
) ON public.products TO anon;
