ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS header_color text,
  ADD COLUMN IF NOT EXISTS title_bar_color text,
  ADD COLUMN IF NOT EXISTS footer_color text,
  ADD COLUMN IF NOT EXISTS button_color text;