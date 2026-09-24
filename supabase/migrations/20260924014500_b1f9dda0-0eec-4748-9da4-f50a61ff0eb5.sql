-- lovable-cron-fallback-reviewed: 1440 runs/day; enqueue trigger is the normal path, while minute-level recovery is retained to recover interrupted Messenger replies within one minute instead of losing accepted customer messages.
CREATE OR REPLACE FUNCTION public.wake_messenger_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://orzen.top/api/public/messenger/process',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('job_id', NEW.id, 'wake_token', NEW.wake_token),
    timeout_milliseconds := 1000
  );
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.wake_messenger_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wake_messenger_job() TO service_role;

DO $$
DECLARE existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'recover-messenger-jobs' LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;
  PERFORM cron.schedule('recover-messenger-jobs', '* * * * *', $cron$
    SELECT net.http_post(
      url := 'https://orzen.top/api/public/messenger/process',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('job_id', id, 'wake_token', wake_token),
      timeout_milliseconds := 1000
    )
    FROM public.messenger_jobs
    WHERE available_at <= now()
      AND (status IN ('pending', 'retry') OR (status = 'processing' AND started_at < now() - interval '3 minutes'))
    ORDER BY created_at
    LIMIT 20;
  $cron$);
END $$;