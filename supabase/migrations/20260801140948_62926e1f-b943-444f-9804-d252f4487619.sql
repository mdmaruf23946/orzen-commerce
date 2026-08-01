ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS max_discount numeric,
  ADD COLUMN IF NOT EXISTS per_customer_limit integer,
  ADD COLUMN IF NOT EXISTS category_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS product_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.coupons SET product_type = 'physical' WHERE product_type IS NULL OR product_type = '';

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_product_type_check
  CHECK (product_type IN ('physical','digital','service','subscription'));

CREATE INDEX IF NOT EXISTS coupons_store_type_idx ON public.coupons(store_id, product_type);