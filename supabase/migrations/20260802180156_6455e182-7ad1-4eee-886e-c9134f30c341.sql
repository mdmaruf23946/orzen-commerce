ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_product_type_check;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_product_type_check
  CHECK (product_type IN ('physical', 'digital', 'service', 'subscription', 'both'));