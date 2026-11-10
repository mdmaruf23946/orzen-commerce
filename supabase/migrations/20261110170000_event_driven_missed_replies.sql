-- Messages are processed only when they arrive (insert trigger wakes the worker).
-- No periodic sweep for Messenger/WhatsApp: a stuck/failed job becomes a "missed reply"
-- that a human re-sends to the AI from the Omni Inbox.
CREATE OR REPLACE FUNCTION public.dispatch_minute_jobs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE j bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM public.voice_call_queue WHERE status='queued' AND run_at <= now()) THEN
    PERFORM net.http_post(url := 'https://orzen.top/api/public/voice/process',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-token',(SELECT token FROM public.internal_cron_tokens WHERE name='default')),
      body := '{}'::jsonb, timeout_milliseconds := 30000);
  END IF;
  -- Disarm when no voice work remains; re-armed by the queue insert trigger.
  IF NOT EXISTS (SELECT 1 FROM public.voice_call_queue WHERE status='queued') THEN
    SELECT jobid INTO j FROM cron.job WHERE jobname='dispatch-minute-jobs';
    IF j IS NOT NULL THEN PERFORM cron.unschedule(j); END IF;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.dispatch_minute_jobs() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.arm_voice_dispatch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status='queued' AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='dispatch-minute-jobs') THEN
    PERFORM cron.schedule('dispatch-minute-jobs','*/10 * * * *','select public.dispatch_minute_jobs()');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.arm_voice_dispatch() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS voice_call_queue_arm ON public.voice_call_queue;
CREATE TRIGGER voice_call_queue_arm AFTER INSERT OR UPDATE OF status ON public.voice_call_queue
FOR EACH ROW EXECUTE FUNCTION public.arm_voice_dispatch();

DO $$ DECLARE j bigint; BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname IN ('recover-messenger-jobs') LOOP PERFORM cron.unschedule(j); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.voice_call_queue WHERE status='queued') THEN
    SELECT jobid INTO j FROM cron.job WHERE jobname='dispatch-minute-jobs';
    IF j IS NOT NULL THEN PERFORM cron.unschedule(j); END IF;
  END IF;
END $$;

-- Human "reply with AI" for a missed message: requeue that customer's unfinished jobs and wake the oldest.
CREATE OR REPLACE FUNCTION public.retry_missed_reply(_conversation_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE c record; n integer := 0; first_id uuid; first_tok uuid; url text;
BEGIN
  SELECT id, store_id, channel, external_id INTO c FROM public.ai_conversations WHERE id=_conversation_id;
  IF c.id IS NULL OR NOT public.has_store_access(c.store_id) THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  UPDATE public.ai_conversations SET handoff_mode='ai', handoff_reason='returned_to_ai', handoff_at=now() WHERE id=c.id;
  IF c.channel='whatsapp' THEN
    UPDATE public.whatsapp_jobs SET status='retry', available_at=now(), started_at=NULL
     WHERE store_id=c.store_id AND sender_id=c.external_id AND created_at > now()-interval '2 days'
       AND status IN ('failed','pending','retry','processing');
    GET DIAGNOSTICS n = ROW_COUNT;
    SELECT id, wake_token INTO first_id, first_tok FROM public.whatsapp_jobs
     WHERE store_id=c.store_id AND sender_id=c.external_id AND status='retry' ORDER BY created_at LIMIT 1;
    url := 'https://orzen.top/api/public/whatsapp/process';
  ELSE
    UPDATE public.messenger_jobs SET status='retry', available_at=now(), started_at=NULL
     WHERE store_id=c.store_id AND sender_id=c.external_id AND created_at > now()-interval '2 days'
       AND status IN ('failed','pending','retry','processing');
    GET DIAGNOSTICS n = ROW_COUNT;
    SELECT id, wake_token INTO first_id, first_tok FROM public.messenger_jobs
     WHERE store_id=c.store_id AND sender_id=c.external_id AND status='retry' ORDER BY created_at LIMIT 1;
    url := 'https://orzen.top/api/public/messenger/process';
  END IF;
  IF first_id IS NOT NULL THEN
    PERFORM net.http_post(url := url, headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('job_id', first_id, 'wake_token', first_tok), timeout_milliseconds := 60000);
  END IF;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.retry_missed_reply(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_missed_reply(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.arm_voice_dispatch(), public.retry_missed_reply(uuid), public.dispatch_minute_jobs() TO service_role;
