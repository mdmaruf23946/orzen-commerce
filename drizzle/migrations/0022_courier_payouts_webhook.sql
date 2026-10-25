ALTER TABLE public.courier_parcels
  ADD COLUMN IF NOT EXISTS cod_collected numeric,
  ADD COLUMN IF NOT EXISTS courier_fee numeric,
  ADD COLUMN IF NOT EXISTS paid_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_ref text,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;
CREATE INDEX IF NOT EXISTS courier_parcels_store_consignment_idx ON public.courier_parcels(store_id, consignment_id);
CREATE INDEX IF NOT EXISTS courier_parcels_store_tracking_idx ON public.courier_parcels(store_id, tracking_code);