-- 1) Products: remove full-row public read from the base table
DROP POLICY IF EXISTS "products public read active" ON public.products;
REVOKE SELECT ON public.products FROM anon;

-- 2) Safe storefront product projection (definer view, no internal fields)
DROP VIEW IF EXISTS public.storefront_products;
CREATE VIEW public.storefront_products
WITH (security_invoker = off) AS
SELECT
  p.id,
  p.store_id,
  p.category_id,
  p.name,
  p.slug,
  p.description,
  p.short_description,
  p.price,
  p.old_price,
  p.stock,
  p.status,
  p.primary_image_url,
  p.gallery,
  p.brand,
  p.sku,
  p.features,
  p.specifications,
  p.variants,
  p.video_url,
  p.warranty,
  p.return_policy,
  p.shipping_info,
  p.delivery_charge,
  p.delivery_time_days,
  p.rating,
  p.total_sold,
  p.related_product_ids,
  p.product_type,
  p.is_featured,
  p.meta,
  p.created_at,
  p.updated_at
FROM public.products p
WHERE p.status = 'active'::product_status
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p.store_id AND s.status = 'active'::store_status
  );

GRANT SELECT ON public.storefront_products TO anon, authenticated;

-- 3) Stores: remove anon full-row access (public storefront uses get_public_store_by_slug)
DROP POLICY IF EXISTS "stores anon public fields" ON public.stores;
REVOKE SELECT ON public.stores FROM anon;
