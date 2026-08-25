-- Public-safe storefront view: exposes only the columns anonymous visitors need,
-- excludes wholesale cost_price and other internal fields, and filters to active
-- products from active stores.
CREATE OR REPLACE VIEW public.storefront_products AS
SELECT
  id,
  store_id,
  category_id,
  name,
  slug,
  description,
  short_description,
  price,
  old_price,
  stock,
  status,
  primary_image_url,
  gallery,
  brand,
  sku,
  product_code,
  features,
  specifications,
  variants,
  video_url,
  warranty,
  return_policy,
  shipping_info,
  delivery_charge,
  delivery_time_days,
  rating,
  total_sold,
  related_product_ids,
  product_type,
  is_featured,
  meta,
  created_at,
  updated_at
FROM public.products
WHERE status = 'active'::product_status
  AND public.is_store_active(store_id);

-- Anonymous storefront traffic must read through the safe view only.
GRANT SELECT ON public.storefront_products TO anon;
GRANT ALL ON public.storefront_products TO service_role;

-- Remove the old direct anonymous access path to the raw products table.
REVOKE ALL ON public.products FROM anon;
DROP POLICY IF EXISTS "products public read active published" ON public.products;