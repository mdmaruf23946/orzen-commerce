ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS transcript jsonb, ADD COLUMN IF NOT EXISTS conversation_text text;

CREATE OR REPLACE FUNCTION public.tg_orzen_call_order_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE c record; body text;
BEGIN
  IF coalesce(NEW.is_test,false) OR NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN ('confirmed','cancelled','pending') THEN RETURN NULL; END IF;
  SELECT account_info, encrypted_token INTO c FROM public.voice_provider_connections
   WHERE store_id = NEW.store_id AND provider = 'orzen_call' AND status = 'connected';
  IF NOT FOUND OR coalesce(c.account_info->>'webhook_url','') = '' THEN RETURN NULL; END IF;
  body := jsonb_build_object('event','order.status_changed','order_id',NEW.id,'status',NEW.status)::text;
  PERFORM net.http_post(url := c.account_info->>'webhook_url', body := body::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','X-Orzen-Event','order.status_changed',
      'X-Orzen-Signature', encode(extensions.hmac(body, coalesce(c.encrypted_token,''), 'sha256'),'hex')),
    timeout_milliseconds := 8000);
  RETURN NULL;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS t_orzen_call_order_status ON public.orders;
CREATE TRIGGER t_orzen_call_order_status AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orzen_call_order_status();