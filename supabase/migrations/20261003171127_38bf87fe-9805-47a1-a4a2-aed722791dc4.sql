-- lovable-cron-fallback-reviewed: calls need delayed start and retries after N minutes; ePBX has no delay-until capability
CREATE OR REPLACE FUNCTION public.tg_enqueue_voice_order_call()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF NEW.payment_method IS DISTINCT FROM 'cod' OR NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  SELECT auto_call_enabled, call_immediately, delay_minutes INTO s
    FROM public.voice_automation_settings WHERE store_id = NEW.store_id;
  IF NOT FOUND OR NOT s.auto_call_enabled THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.voice_provider_connections
                 WHERE store_id = NEW.store_id AND provider = 'epbx' AND status = 'connected') THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.voice_call_queue (store_id, order_id, run_at)
  VALUES (NEW.store_id, NEW.id,
          now() + make_interval(mins => CASE WHEN s.call_immediately THEN 1 ELSE greatest(s.delay_minutes, 1) END))
  ON CONFLICT (order_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW; -- never block an order
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_enqueue_voice_order_call() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_orders_voice_call ON public.orders;
CREATE TRIGGER t_orders_voice_call AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_voice_order_call();

DO $$
DECLARE j bigint;
BEGIN
  SELECT jobid INTO j FROM cron.job WHERE jobname = 'process-voice-call-queue' LIMIT 1;
  IF j IS NOT NULL THEN PERFORM cron.unschedule(j); END IF;
  PERFORM cron.schedule('process-voice-call-queue', '* * * * *', $cron$
    SELECT net.http_post(
      url := 'https://orzen.top/api/public/voice/process',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
    WHERE EXISTS (SELECT 1 FROM public.voice_call_queue WHERE status = 'queued' AND run_at <= now());
  $cron$);
END $$;