CREATE OR REPLACE FUNCTION public.get_my_active_ads()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s record;
  st record;
  tier text;
  result jsonb;
BEGIN
  SELECT * INTO s FROM public.ad_settings WHERE id = 'global';
  IF s IS NULL OR NOT s.enabled THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT stores.subscription_status AS status,
         sp.plan_tier AS plan_tier,
         sp.is_trial AS is_trial,
         sp.price AS price,
         sp.id AS pkg_id
    INTO st
    FROM public.stores
    LEFT JOIN public.subscription_packages sp ON sp.id = public.stores.package_id
   WHERE public.stores.owner_user_id = auth.uid()
   LIMIT 1;

  IF st IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF st.pkg_id IS NULL
     OR COALESCE(st.status, 'active') IN ('expired', 'suspended', 'cancelled') THEN
    tier := 'free';
  ELSIF COALESCE(st.is_trial, false) THEN
    tier := 'trial';
  ELSE
    tier := COALESCE(
      NULLIF(st.plan_tier, ''),
      CASE WHEN COALESCE(st.price, 0) <= 0 THEN 'free' ELSE 'paid' END
    );
  END IF;

  IF NOT (tier = ANY(s.show_on_plans)) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'slot_key', slot_key, 'code', code, 'format', format
  )), '[]'::jsonb)
    INTO result
    FROM public.ad_slots
   WHERE is_active = true
     AND (starts_at IS NULL OR starts_at <= now())
     AND (ends_at IS NULL OR ends_at > now());

  RETURN result;
END $function$;