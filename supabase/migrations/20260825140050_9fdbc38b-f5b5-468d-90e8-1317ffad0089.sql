-- 1) Showcase mockups managed by the platform owner
CREATE TABLE public.platform_showcase (
  key text PRIMARY KEY,
  desktop_url text,
  mobile_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_showcase TO anon;
GRANT SELECT ON public.platform_showcase TO authenticated;
GRANT ALL ON public.platform_showcase TO service_role;

ALTER TABLE public.platform_showcase ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_showcase public read"
  ON public.platform_showcase FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "platform_showcase owner write"
  ON public.platform_showcase FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

GRANT INSERT, UPDATE, DELETE ON public.platform_showcase TO authenticated;

CREATE TRIGGER platform_showcase_updated_at
  BEFORE UPDATE ON public.platform_showcase
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Storefront products view: run as invoker again (no SECURITY DEFINER view),
-- with column-level grants so anon can never read cost_price or other internals.
ALTER VIEW public.storefront_products SET (security_invoker = on);

GRANT SELECT (
  id, store_id, category_id, name, slug, description, short_description,
  price, old_price, stock, status, primary_image_url, gallery, brand, sku,
  product_code, features, specifications, variants, video_url, warranty,
  return_policy, shipping_info, delivery_charge, delivery_time_days, rating,
  total_sold, related_product_ids, product_type, is_featured, meta,
  created_at, updated_at
) ON public.products TO anon;

DROP POLICY IF EXISTS "products public read active published" ON public.products;
CREATE POLICY "products public read active published"
  ON public.products FOR SELECT
  TO anon
  USING (status = 'active'::product_status AND public.is_store_active(store_id));
