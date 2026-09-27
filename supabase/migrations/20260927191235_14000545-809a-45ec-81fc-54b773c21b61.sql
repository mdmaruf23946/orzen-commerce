ALTER TABLE public.whatsapp_jobs ADD COLUMN IF NOT EXISTS merged_into uuid NULL, ADD COLUMN IF NOT EXISTS route text NULL;
ALTER TABLE public.whatsapp_jobs DROP CONSTRAINT IF EXISTS whatsapp_jobs_status_check;
ALTER TABLE public.whatsapp_jobs ADD CONSTRAINT whatsapp_jobs_status_check CHECK (status = ANY (ARRAY['pending','processing','retry','sent','failed','skipped','merged']));