ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS qty_before integer,
  ADD COLUMN IF NOT EXISTS qty_after integer;