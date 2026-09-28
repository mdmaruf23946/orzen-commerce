CREATE OR REPLACE FUNCTION public.tg_wake_whatsapp_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
BEGIN
  IF NEW.status IN ('pending','retry') THEN
    PERFORM net.http_post(
      url := 'https://orzen.top/api/public/whatsapp/process',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('job_id', NEW.id, 'wake_token', NEW.wake_token),
      timeout_milliseconds := 60000);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_wake_whatsapp_job() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS whatsapp_jobs_wake ON public.whatsapp_jobs;
CREATE TRIGGER whatsapp_jobs_wake AFTER INSERT ON public.whatsapp_jobs
FOR EACH ROW EXECUTE FUNCTION public.tg_wake_whatsapp_job();