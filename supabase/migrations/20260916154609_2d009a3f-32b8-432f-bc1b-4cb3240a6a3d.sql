CREATE OR REPLACE FUNCTION public.expire_due_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  UPDATE public.stores
     SET subscription_status = 'expired'
   WHERE subscription_status IN ('trialing','active')
     AND (
       (subscription_status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at < now())
       OR (expires_at IS NOT NULL AND expires_at < now())
     );
END $fn$;

REVOKE ALL ON FUNCTION public.expire_due_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_due_subscriptions() TO service_role;

CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  PERFORM public.expire_due_subscriptions();
END $fn$;

CREATE OR REPLACE FUNCTION public.refresh_store_subscription_status(_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_store_access(_store_id) THEN
    RETURN;
  END IF;

  UPDATE public.stores
     SET subscription_status = 'expired'
   WHERE id = _store_id
     AND subscription_status IN ('trialing','active')
     AND (
       (subscription_status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at < now())
       OR (expires_at IS NOT NULL AND expires_at < now())
     );
END $fn$;

REVOKE ALL ON FUNCTION public.refresh_store_subscription_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_store_subscription_status(uuid) TO authenticated, service_role;

SELECT cron.unschedule('expire-due-subscriptions')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-due-subscriptions');
SELECT cron.schedule('expire-due-subscriptions', '0 * * * *', $cron$ SELECT public.expire_due_subscriptions(); $cron$);

SELECT public.expire_due_subscriptions();