-- lovable-cron-fallback-reviewed: 1440 runs/day; immediate trigger wake handles normal work, while this minute-level recovery backstop is required to recover interrupted Messenger jobs within one minute instead of losing accepted customer messages.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE TABLE public.messenger_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.messenger_integrations(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  sender_id text NOT NULL,
  message_id text NOT NULL,
  event_payload jsonb NOT NULL,
  wake_token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','retry','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  reply_text text,
  outbound_message_id text,
  last_error text,
  processing_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, message_id)
);
GRANT SELECT ON public.messenger_jobs TO authenticated;
GRANT ALL ON public.messenger_jobs TO service_role;
ALTER TABLE public.messenger_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store members can view own Messenger jobs" ON public.messenger_jobs FOR SELECT TO authenticated USING (public.has_store_access(store_id));
CREATE POLICY "Service role manages Messenger jobs" ON public.messenger_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX messenger_jobs_due_idx ON public.messenger_jobs (available_at, created_at) WHERE status IN ('pending','retry');
CREATE INDEX messenger_jobs_store_created_idx ON public.messenger_jobs (store_id, created_at DESC);
CREATE INDEX messenger_jobs_sender_order_idx ON public.messenger_jobs (store_id, sender_id, created_at);
CREATE TRIGGER messenger_jobs_touch_updated_at BEFORE UPDATE ON public.messenger_jobs FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE OR REPLACE FUNCTION public.claim_messenger_job(_job_id uuid, _wake_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed public.messenger_jobs;
BEGIN
  UPDATE public.messenger_jobs j SET status='processing', attempts=j.attempts+1, started_at=now(), last_error=NULL
  WHERE j.id=_job_id AND j.wake_token=_wake_token AND j.available_at<=now()
    AND (j.status IN ('pending','retry') OR (j.status='processing' AND j.started_at<now()-interval '3 minutes'))
    AND NOT EXISTS (SELECT 1 FROM public.messenger_jobs older WHERE older.store_id=j.store_id AND older.sender_id=j.sender_id AND older.created_at<j.created_at AND older.status IN ('pending','processing','retry'))
  RETURNING j.* INTO claimed;
  RETURN CASE WHEN claimed.id IS NULL THEN NULL ELSE to_jsonb(claimed) END;
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_messenger_job(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_messenger_job(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.wake_messenger_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  PERFORM net.http_post(url:='https://orzen-commerce.lovable.app/api/public/messenger/process', headers:=jsonb_build_object('Content-Type','application/json'), body:=jsonb_build_object('job_id',NEW.id,'wake_token',NEW.wake_token), timeout_milliseconds:=1000);
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.wake_messenger_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wake_messenger_job() TO service_role;
CREATE TRIGGER messenger_jobs_wake_after_insert AFTER INSERT ON public.messenger_jobs FOR EACH ROW EXECUTE FUNCTION public.wake_messenger_job();

DO $$ DECLARE existing_job bigint; BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname='recover-messenger-jobs' LIMIT 1;
  IF existing_job IS NOT NULL THEN PERFORM cron.unschedule(existing_job); END IF;
  PERFORM cron.schedule('recover-messenger-jobs','* * * * *',$cron$
    SELECT net.http_post(url:='https://orzen-commerce.lovable.app/api/public/messenger/process', headers:=jsonb_build_object('Content-Type','application/json'), body:=jsonb_build_object('job_id',id,'wake_token',wake_token), timeout_milliseconds:=1000)
    FROM public.messenger_jobs
    WHERE available_at<=now() AND (status IN ('pending','retry') OR (status='processing' AND started_at<now()-interval '3 minutes'))
    ORDER BY created_at LIMIT 20;
  $cron$);
END $$;