
DROP POLICY IF EXISTS "public reads active coupons" ON public.coupons;

CREATE OR REPLACE FUNCTION public.validate_coupon(_store_id uuid, _code text, _subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c record; discount numeric := 0; free_shipping boolean := false;
BEGIN
  SELECT id, code, type, value, min_order, usage_limit, used_count, expires_at, active
    INTO c
    FROM public.coupons
   WHERE store_id = _store_id AND code = upper(_code)
   LIMIT 1;
  IF NOT FOUND OR NOT c.active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid coupon');
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Coupon expired');
  END IF;
  IF c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usage limit reached');
  END IF;
  IF _subtotal < COALESCE(c.min_order, 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Minimum order not met');
  END IF;
  IF c.type = 'percent' THEN discount := round(_subtotal * c.value / 100);
  ELSIF c.type = 'fixed' THEN discount := least(c.value, _subtotal);
  ELSIF c.type = 'free_shipping' THEN free_shipping := true;
  END IF;
  RETURN jsonb_build_object(
    'ok', true, 'couponId', c.id, 'code', c.code, 'type', c.type,
    'discount', discount, 'freeShipping', free_shipping
  );
END $$;

REVOKE ALL ON FUNCTION public.validate_coupon(uuid, text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_coupon(uuid, text, numeric) TO anon, authenticated;
