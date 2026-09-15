-- Public storefront reads no longer rely on a SECURITY DEFINER view.
ALTER VIEW public.storefront_products SET (security_invoker = on);

-- Row access for anonymous shoppers: only active products of active stores.
DROP POLICY IF EXISTS "products storefront anon read" ON public.products;
CREATE POLICY "products storefront anon read"
  ON public.products
  FOR SELECT
  TO anon
  USING (status = 'active'::product_status AND public.is_store_active(store_id));

-- Column access: everything the storefront shows, never the internal fields.
REVOKE ALL ON public.products FROM anon;
GRANT SELECT (
  id, store_id, category_id, name, slug, description, short_description,
  price, old_price, stock, status, primary_image_url, gallery, brand, sku,
  features, specifications, variants, video_url, warranty, return_policy,
  shipping_info, delivery_charge, delivery_time_days, rating, total_sold,
  related_product_ids, product_type, is_featured, meta, created_at, updated_at
) ON public.products TO anon;

GRANT SELECT ON public.storefront_products TO anon, authenticated;