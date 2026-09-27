CREATE OR REPLACE FUNCTION public.kick_whatsapp_job(_job_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
DECLARE j public.whatsapp_jobs;
BEGIN
  SELECT * INTO j FROM public.whatsapp_jobs WHERE id=_job_id AND status IN ('pending','retry');
  IF j.id IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://orzen.top/api/public/whatsapp/process',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('job_id', j.id, 'wake_token', j.wake_token),
    timeout_milliseconds := 60000);
END; $$;
REVOKE ALL ON FUNCTION public.kick_whatsapp_job(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kick_whatsapp_job(uuid) TO service_role;