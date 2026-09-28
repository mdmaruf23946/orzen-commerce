ALTER TABLE public.whatsapp_jobs ADD COLUMN IF NOT EXISTS timings jsonb, ADD COLUMN IF NOT EXISTS received_at timestamptz, ADD COLUMN IF NOT EXISTS trace_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.messenger_jobs ADD COLUMN IF NOT EXISTS timings jsonb, ADD COLUMN IF NOT EXISTS received_at timestamptz, ADD COLUMN IF NOT EXISTS trace_id uuid DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS whatsapp_jobs_created_idx ON public.whatsapp_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_jobs_store_created_idx ON public.whatsapp_jobs (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messenger_jobs_created_idx ON public.messenger_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS messenger_jobs_store_created_idx ON public.messenger_jobs (store_id, created_at DESC);