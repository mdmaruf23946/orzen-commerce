ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_type_chk;

ALTER TABLE public.products
  ADD CONSTRAINT products_product_type_chk
  CHECK (product_type IN ('physical', 'digital', 'service', 'subscription'));