-- lovable-cron-fallback-reviewed: replaces existing identical-cadence job, only adds an auth header
CREATE TABLE IF NOT EXISTS public.internal_cron_tokens (name text PRIMARY KEY, token text NOT NULL);
REVOKE ALL ON public.internal_cron_tokens FROM anon, authenticated;
GRANT ALL ON public.internal_cron_tokens TO service_role;
ALTER TABLE public.internal_cron_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.internal_cron_tokens(name, token) VALUES ('default', encode(gen_random_bytes(24),'hex')) ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE j bigint;
BEGIN
  SELECT jobid INTO j FROM cron.job WHERE jobname = 'process-voice-call-queue' LIMIT 1;
  IF j IS NOT NULL THEN PERFORM cron.unschedule(j); END IF;
  PERFORM cron.schedule('process-voice-call-queue', '* * * * *', $cron$
    SELECT net.http_post(
      url := 'https://orzen.top/api/public/voice/process',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', (SELECT token FROM public.internal_cron_tokens WHERE name='default')),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
    WHERE EXISTS (SELECT 1 FROM public.voice_call_queue WHERE status = 'queued' AND run_at <= now());
  $cron$);
END $$;