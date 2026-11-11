REVOKE EXECUTE ON FUNCTION public.get_public_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_service_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_subscription_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_service_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_subscription_order(uuid) TO service_role;

ALTER TABLE public.checkout_drafts ADD COLUMN IF NOT EXISTS owner_hash text;

CREATE OR REPLACE FUNCTION public.tg_protect_store_billing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Direct API updates by signed-in users cannot change plan/billing fields;
  -- platform owners and server-side (service role / definer) code still can.
  IF current_user IN ('authenticated', 'anon') AND NOT public.has_role(auth.uid(), 'owner'::app_role) THEN
    IF NEW.package_id IS DISTINCT FROM OLD.package_id
       OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
       OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Plan and billing fields can only be changed by the platform';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_store_billing ON public.stores;
CREATE TRIGGER trg_protect_store_billing BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_store_billing();