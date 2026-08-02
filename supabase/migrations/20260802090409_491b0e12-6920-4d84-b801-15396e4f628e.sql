ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS country text;

CREATE TABLE IF NOT EXISTS public.digital_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  entitlement_id uuid,
  order_id uuid,
  actor uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS digital_access_events_store_idx ON public.digital_access_events(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS digital_access_events_order_idx ON public.digital_access_events(order_id);

GRANT SELECT ON public.digital_access_events TO authenticated;
GRANT ALL ON public.digital_access_events TO service_role;

ALTER TABLE public.digital_access_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners read their digital access events"
  ON public.digital_access_events
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = digital_access_events.store_id AND s.owner_user_id = auth.uid()));