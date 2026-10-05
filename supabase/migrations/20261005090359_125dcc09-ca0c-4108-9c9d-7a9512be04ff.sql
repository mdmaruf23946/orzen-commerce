ALTER TABLE public.voice_automation_settings ADD COLUMN IF NOT EXISTS call_rate_per_min numeric;
CREATE INDEX IF NOT EXISTS calls_store_created_idx ON public.calls (store_id, created_at DESC);