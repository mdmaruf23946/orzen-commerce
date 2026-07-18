
ALTER TABLE public.fraud_checks
  ADD COLUMN IF NOT EXISTS check_count int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_check_source text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS last_check_by uuid;

UPDATE public.fraud_checks
   SET first_checked_at = COALESCE(first_checked_at, checked_at);

DO $$ BEGIN
  ALTER TABLE public.fraud_checks
    ADD CONSTRAINT fraud_checks_last_source_chk
    CHECK (last_check_source IN ('system','admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
