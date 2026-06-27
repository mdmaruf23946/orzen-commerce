
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS marketing jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS couriers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payments_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS product_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS warranty text,
  ADD COLUMN IF NOT EXISTS return_policy text,
  ADD COLUMN IF NOT EXISTS shipping_info text;
