CREATE TABLE public.marketing_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('facebook','google','tiktok')),
  campaign text,
  click_id text,
  landing_path text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, session_id)
);
CREATE INDEX marketing_visits_store_platform_idx ON public.marketing_visits(store_id, platform, created_at);
GRANT SELECT ON public.marketing_visits TO authenticated;
GRANT ALL ON public.marketing_visits TO service_role;
ALTER TABLE public.marketing_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store team reads visits" ON public.marketing_visits FOR SELECT TO authenticated USING (public.has_store_access(store_id));

CREATE TABLE public.marketing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('facebook','google','tiktok')),
  event_type text NOT NULL CHECK (event_type IN ('page_view','product_view','add_to_cart','checkout','purchase')),
  path text,
  order_id uuid,
  value numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketing_events_store_platform_idx ON public.marketing_events(store_id, platform, created_at);
CREATE UNIQUE INDEX marketing_events_purchase_once ON public.marketing_events(store_id, order_id) WHERE order_id IS NOT NULL;
GRANT SELECT ON public.marketing_events TO authenticated;
GRANT ALL ON public.marketing_events TO service_role;
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store team reads events" ON public.marketing_events FOR SELECT TO authenticated USING (public.has_store_access(store_id));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS attribution_platform text,
  ADD COLUMN IF NOT EXISTS attribution_campaign text,
  ADD COLUMN IF NOT EXISTS attribution_session_id text;
CREATE INDEX IF NOT EXISTS orders_attribution_idx ON public.orders(store_id, attribution_platform, created_at) WHERE attribution_platform IS NOT NULL;