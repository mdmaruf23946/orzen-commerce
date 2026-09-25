CREATE TABLE public.ai_product_catalog (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  brand text,
  product_code text,
  sku text,
  category_id uuid,
  product_type text NOT NULL DEFAULT 'physical',
  price numeric NOT NULL DEFAULT 0,
  old_price numeric,
  stock integer NOT NULL DEFAULT 0,
  status public.product_status NOT NULL,
  short_description text,
  description text,
  primary_image_url text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  specifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_sold integer NOT NULL DEFAULT 0,
  rating numeric,
  is_featured boolean NOT NULL DEFAULT false,
  search_text text NOT NULL DEFAULT '',
  source_updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_product_catalog TO service_role;
ALTER TABLE public.ai_product_catalog ENABLE ROW LEVEL SECURITY;
CREATE INDEX ai_product_catalog_store_status_idx ON public.ai_product_catalog(store_id, status, stock);
CREATE INDEX ai_product_catalog_store_search_idx ON public.ai_product_catalog USING gin (to_tsvector('simple', search_text));

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
    rating, is_featured, search_text, source_updated_at, updated_at
  ) VALUES (
    NEW.id, NEW.store_id, NEW.name, NEW.slug, NEW.brand, NEW.product_code, NEW.sku, NEW.category_id,
    COALESCE(NEW.product_type, 'physical'), NEW.price, NEW.old_price, COALESCE(NEW.stock, 0), NEW.status,
    NEW.short_description, NEW.description, NEW.primary_image_url, COALESCE(NEW.gallery, '[]'::jsonb),
    COALESCE(NEW.features, '[]'::jsonb), COALESCE(NEW.specifications, '[]'::jsonb),
    COALESCE(NEW.variants, '[]'::jsonb), COALESCE(NEW.total_sold, 0), NEW.rating,
    COALESCE(NEW.is_featured, false),
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
    search_text = EXCLUDED.search_text,
    source_updated_at = EXCLUDED.source_updated_at,
    updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_ai_product_catalog_row() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_ai_product_catalog_row() TO service_role;

CREATE TRIGGER sync_ai_product_catalog_after_product_change
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_ai_product_catalog_row();

CREATE OR REPLACE FUNCTION public.invalidate_product_image_embedding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'active' OR COALESCE(NEW.stock, 0) <= 0
     OR NEW.primary_image_url IS DISTINCT FROM OLD.primary_image_url
     OR NEW.gallery IS DISTINCT FROM OLD.gallery THEN
    DELETE FROM public.product_image_embeddings WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_product_image_embedding() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_product_image_embedding() TO service_role;

CREATE TRIGGER invalidate_product_image_embedding_after_product_change
AFTER UPDATE OF status, stock, primary_image_url, gallery ON public.products
FOR EACH ROW EXECUTE FUNCTION public.invalidate_product_image_embedding();

INSERT INTO public.ai_product_catalog (
  product_id, store_id, name, slug, brand, product_code, sku, category_id,
  product_type, price, old_price, stock, status, short_description, description,
  primary_image_url, gallery, features, specifications, variants, total_sold,
  rating, is_featured, search_text, source_updated_at
)
SELECT
  p.id, p.store_id, p.name, p.slug, p.brand, p.product_code, p.sku, p.category_id,
  COALESCE(p.product_type, 'physical'), p.price, p.old_price, COALESCE(p.stock, 0), p.status,
  p.short_description, p.description, p.primary_image_url, COALESCE(p.gallery, '[]'::jsonb),
  COALESCE(p.features, '[]'::jsonb), COALESCE(p.specifications, '[]'::jsonb),
  COALESCE(p.variants, '[]'::jsonb), COALESCE(p.total_sold, 0), p.rating,
  COALESCE(p.is_featured, false),
  lower(concat_ws(' ', p.name, p.brand, p.product_code, p.sku, p.short_description,
    p.description, p.features::text, p.specifications::text, p.variants::text)),
  p.updated_at
FROM public.products p;

DELETE FROM public.product_image_embeddings e
USING public.products p
WHERE e.product_id = p.id
  AND (p.status <> 'active' OR COALESCE(p.stock, 0) <= 0);