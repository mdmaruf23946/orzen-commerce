
CREATE OR REPLACE FUNCTION public.refresh_store_subscription_status(_store_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE free_id uuid;
BEGIN
  -- Only the owning user (or an internal/service caller with no JWT) may refresh.
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.stores WHERE id = _store_id AND owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO free_id FROM public.subscription_packages
    WHERE plan_tier = 'free' AND is_active = true ORDER BY sort_order LIMIT 1;
  UPDATE public.stores
     SET package_id = COALESCE(free_id, package_id),
         subscription_status = 'active',
         trial_ends_at = NULL,
         expires_at = now() + interval '30 days'
   WHERE id = _store_id
     AND subscription_status = 'trialing'
     AND trial_ends_at IS NOT NULL
     AND trial_ends_at < now();

  UPDATE public.stores
     SET subscription_status = CASE
       WHEN subscription_status = 'suspended' THEN 'suspended'
       WHEN expires_at IS NULL THEN subscription_status
       WHEN expires_at < now() THEN 'expired'
       WHEN expires_at >= now() AND last_renewed_at IS NOT NULL THEN 'active'
       WHEN expires_at >= now() AND trial_ends_at IS NOT NULL AND expires_at = trial_ends_at THEN 'trialing'
       ELSE 'active'
     END
   WHERE id = _store_id;
END $function$;

REVOKE EXECUTE ON FUNCTION public.refresh_store_subscription_status(uuid) FROM anon;

-- Trigger-only / internal helpers must not be callable through the API.
REVOKE EXECUTE ON FUNCTION public._default_invoice_prefix(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._normalize_phone(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_store_template_for_seed() FROM anon;
