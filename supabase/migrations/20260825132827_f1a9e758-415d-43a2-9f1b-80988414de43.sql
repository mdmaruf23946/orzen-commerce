-- Disable invoker rights so the view runs as its owner (postgres), which can
-- read the products table without exposing internal columns like cost_price.
ALTER VIEW public.storefront_products SET (security_invoker = off);

-- Ensure anonymous visitors can still read the safe view.
GRANT SELECT ON public.storefront_products TO anon;