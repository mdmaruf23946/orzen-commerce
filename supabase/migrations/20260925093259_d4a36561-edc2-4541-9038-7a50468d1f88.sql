ALTER TABLE public.ai_product_catalog
  ADD COLUMN meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN video_url text,
  ADD COLUMN delivery_charge numeric,
  ADD COLUMN delivery_time_days text,
  ADD COLUMN warranty text,
  ADD COLUMN return_policy text,
  ADD COLUMN shipping_info text;

CREATE OR REPLACE FUNCTION public.sync_ai_product_catalog_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.ai_product_catalog WHERE product_id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.ai_product_catalog (
    product_id, store_id, name, slug, brand, product_code, sku, category_id,
    product_type, price, old_price, stock, status, short_description, description,
    primary_image_url, gallery, features, specifications, variants, total_sold,
    rating, is_featured, meta, video_url, delivery_charge, delivery_time_days,
    warranty, return_policy, shipping_info, search_text, source_updated_at, updated_at
  ) VALUES (
    NEW.id, NEW.store_id, NEW.name, NEW.slug, NEW.brand, NEW.product_code, NEW.sku, NEW.category_id,
    COALESCE(NEW.product_type, 'physical'), NEW.price, NEW.old_price, COALESCE(NEW.stock, 0), NEW.status,
    NEW.short_description, NEW.description, NEW.primary_image_url, COALESCE(NEW.gallery, '[]'::jsonb),
    COALESCE(NEW.features, '[]'::jsonb), COALESCE(NEW.specifications, '[]'::jsonb),
    COALESCE(NEW.variants, '[]'::jsonb), COALESCE(NEW.total_sold, 0), NEW.rating,
    COALESCE(NEW.is_featured, false), COALESCE(NEW.meta, '{}'::jsonb), NEW.video_url,
    NEW.delivery_charge, NEW.delivery_time_days, NEW.warranty, NEW.return_policy, NEW.shipping_info,
    lower(concat_ws(' ', NEW.name, NEW.brand, NEW.product_code, NEW.sku, NEW.short_description,
      NEW.description, NEW.features::text, NEW.specifications::text, NEW.variants::text)),
    NEW.updated_at, now()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    store_id = EXCLUDED.store_id,
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    brand = EXCLUDED.brand,
    product_code = EXCLUDED.product_code,
    sku = EXCLUDED.sku,
    category_id = EXCLUDED.category_id,
    product_type = EXCLUDED.product_type,
    price = EXCLUDED.price,
    old_price = EXCLUDED.old_price,
    stock = EXCLUDED.stock,
    status = EXCLUDED.status,
    short_description = EXCLUDED.short_description,
    description = EXCLUDED.description,
    primary_image_url = EXCLUDED.primary_image_url,
    gallery = EXCLUDED.gallery,
    features = EXCLUDED.features,
    specifications = EXCLUDED.specifications,
    variants = EXCLUDED.variants,
    total_sold = EXCLUDED.total_sold,
    rating = EXCLUDED.rating,
    is_featured = EXCLUDED.is_featured,
    meta = EXCLUDED.meta,
    video_url = EXCLUDED.video_url,
    delivery_charge = EXCLUDED.delivery_charge,
    delivery_time_days = EXCLUDED.delivery_time_days,
    warranty = EXCLUDED.warranty,
    return_policy = EXCLUDED.return_policy,
    shipping_info = EXCLUDED.shipping_info,
    search_text = EXCLUDED.search_text,
    source_updated_at = EXCLUDED.source_updated_at,
    updated_at = now();
  RETURN NEW;
END;
$$;

UPDATE public.products SET updated_at = updated_at;