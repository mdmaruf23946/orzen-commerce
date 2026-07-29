
CREATE TABLE public.courier_parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  courier_key text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  consignment_id text,
  tracking_code text,
  tracking_url text,
  cod_amount numeric NOT NULL DEFAULT 0,
  delivery_charge numeric NOT NULL DEFAULT 0,
  return_charge numeric NOT NULL DEFAULT 0,
  collection_status text NOT NULL DEFAULT 'pending',
  weight numeric,
  dimensions text,
  note text,
  recipient_name text,
  recipient_phone text,
  recipient_address text,
  recipient_city text,
  recipient_zone text,
  recipient_area text,
  item_count integer NOT NULL DEFAULT 1,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  request_payload jsonb,
  response_payload jsonb,
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_courier_parcels_store ON public.courier_parcels(store_id, created_at DESC);
CREATE INDEX idx_courier_parcels_order ON public.courier_parcels(order_id);
CREATE INDEX idx_courier_parcels_status ON public.courier_parcels(store_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_parcels TO authenticated;
GRANT ALL ON public.courier_parcels TO service_role;
ALTER TABLE public.courier_parcels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their parcels" ON public.courier_parcels
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_courier_parcels_updated BEFORE UPDATE ON public.courier_parcels
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.courier_parcel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id uuid NOT NULL REFERENCES public.courier_parcels(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text,
  source text NOT NULL DEFAULT 'api',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_courier_parcel_events_parcel ON public.courier_parcel_events(parcel_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_parcel_events TO authenticated;
GRANT ALL ON public.courier_parcel_events TO service_role;
ALTER TABLE public.courier_parcel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their parcel events" ON public.courier_parcel_events
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

CREATE TABLE public.courier_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  parcel_id uuid REFERENCES public.courier_parcels(id) ON DELETE CASCADE,
  courier_key text NOT NULL,
  action text NOT NULL,
  endpoint text,
  method text,
  request jsonb,
  response jsonb,
  http_status integer,
  duration_ms integer,
  ok boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_courier_api_logs_store ON public.courier_api_logs(store_id, created_at DESC);
CREATE INDEX idx_courier_api_logs_parcel ON public.courier_api_logs(parcel_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.courier_api_logs TO authenticated;
GRANT ALL ON public.courier_api_logs TO service_role;
ALTER TABLE public.courier_api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their courier logs" ON public.courier_api_logs
  FOR SELECT TO authenticated USING (public.is_store_owner(store_id));
CREATE POLICY "Owners write their courier logs" ON public.courier_api_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_store_owner(store_id));
CREATE POLICY "Owners delete their courier logs" ON public.courier_api_logs
  FOR DELETE TO authenticated USING (public.is_store_owner(store_id));

CREATE TABLE public.courier_pickup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  courier_key text NOT NULL,
  contact_name text,
  phone text,
  address text,
  pickup_date date,
  parcel_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'requested',
  response jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_courier_pickups_store ON public.courier_pickup_requests(store_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_pickup_requests TO authenticated;
GRANT ALL ON public.courier_pickup_requests TO service_role;
ALTER TABLE public.courier_pickup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their pickups" ON public.courier_pickup_requests
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_courier_pickups_updated BEFORE UPDATE ON public.courier_pickup_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
