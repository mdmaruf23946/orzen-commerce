ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS internal_note text,
  ADD COLUMN IF NOT EXISTS manual_adjustment numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT 'customer';