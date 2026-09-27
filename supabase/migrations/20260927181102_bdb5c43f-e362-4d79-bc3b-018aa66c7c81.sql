CREATE TABLE IF NOT EXISTS public.whatsapp_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.whatsapp_integrations(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL,
  sender_id text NOT NULL,
  message_id text NOT NULL,
  conversation_id uuid,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  wake_token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','retry','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  reply_text text,
  last_error text,
  processing_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_number_id, message_id)
);
GRANT SELECT ON public.whatsapp_jobs TO authenticated;
GRANT ALL ON public.whatsapp_jobs TO service_role;
ALTER TABLE public.whatsapp_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners view their WhatsApp jobs" ON public.whatsapp_jobs FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));
CREATE INDEX IF NOT EXISTS whatsapp_jobs_due_idx ON public.whatsapp_jobs (status, available_at);
CREATE INDEX IF NOT EXISTS whatsapp_jobs_sender_idx ON public.whatsapp_jobs (store_id, sender_id, created_at);
CREATE TRIGGER whatsapp_jobs_touch BEFORE UPDATE ON public.whatsapp_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_whatsapp_job(_job_id uuid, _wake_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE claimed public.whatsapp_jobs;
BEGIN
  UPDATE public.whatsapp_jobs j SET status='processing', attempts=j.attempts+1, started_at=now(), last_error=NULL
  WHERE j.id=_job_id AND j.wake_token=_wake_token AND j.available_at<=now()
    AND (j.status IN ('pending','retry') OR (j.status='processing' AND j.started_at<now()-interval '90 seconds'))
    AND NOT EXISTS (SELECT 1 FROM public.whatsapp_jobs older WHERE older.store_id=j.store_id AND older.sender_id=j.sender_id AND older.created_at<j.created_at AND older.status IN ('pending','processing','retry'))
  RETURNING j.* INTO claimed;
  RETURN CASE WHEN claimed.id IS NULL THEN NULL ELSE to_jsonb(claimed) END;
END; $$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_job(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_job(uuid, uuid) TO service_role;