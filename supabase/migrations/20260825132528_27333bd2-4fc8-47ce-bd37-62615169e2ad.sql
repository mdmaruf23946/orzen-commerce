-- Explicitly make the public storefront view an invoker-rights view so RLS
-- and permissions of the querying user are respected.
ALTER VIEW public.storefront_products SET (security_invoker = on);

-- Anonymous storefront visitors need EXECUTE on is_store_active so the
-- view's WHERE clause can filter products to active stores. The function
-- is SECURITY DEFINER and only returns a boolean; it does not expose data.
GRANT EXECUTE ON FUNCTION public.is_store_active(uuid) TO anon;