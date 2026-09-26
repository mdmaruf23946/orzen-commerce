-- lovable-cron-fallback-reviewed: existing 1440 runs/day recovery job kept at same cadence; only HTTP timeout and stale window change so interrupted Messenger replies recover in ~90s.
CREATE OR REPLACE FUNCTION public.wake_messenger_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://orzen.top/api/public/messenger/process',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('job_id', NEW.id, 'wake_token', NEW.wake_token),
    timeout_milliseconds := 60000
  );
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.wake_messenger_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wake_messenger_job() TO service_role;

CREATE OR REPLACE FUNCTION public.claim_messenger_job(_job_id uuid, _wake_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE claimed public.messenger_jobs;
BEGIN
  UPDATE public.messenger_jobs j SET status='processing', attempts=j.attempts+1, started_at=now(), last_error=NULL
  WHERE j.id=_job_id AND j.wake_token=_wake_token AND j.available_at<=now()
    AND (j.status IN ('pending','retry') OR (j.status='processing' AND j.started_at<now()-interval '90 seconds'))
    AND NOT EXISTS (SELECT 1 FROM public.messenger_jobs older WHERE older.store_id=j.store_id AND older.sender_id=j.sender_id AND older.created_at<j.created_at AND older.status IN ('pending','processing','retry'))
  RETURNING j.* INTO claimed;
  RETURN CASE WHEN claimed.id IS NULL THEN NULL ELSE to_jsonb(claimed) END;
END; $function$;

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
      timeout_milliseconds := 60000
    )
    FROM public.messenger_jobs
    WHERE available_at <= now()
      AND (status IN ('pending', 'retry') OR (status = 'processing' AND started_at < now() - interval '90 seconds'))
    ORDER BY created_at
    LIMIT 20;
  $cron$);
END $$;