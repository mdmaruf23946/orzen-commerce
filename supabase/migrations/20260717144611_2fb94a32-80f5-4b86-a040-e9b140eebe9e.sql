
CREATE OR REPLACE FUNCTION public.get_billing_discounts()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'discount_3m', COALESCE(discount_3m, 5),
    'discount_6m', COALESCE(discount_6m, 10),
    'discount_yearly', COALESCE(discount_yearly, 20)
  )
  FROM public.platform_billing_settings
  WHERE id = 'global'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_billing_discounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_billing_discounts() TO authenticated;
