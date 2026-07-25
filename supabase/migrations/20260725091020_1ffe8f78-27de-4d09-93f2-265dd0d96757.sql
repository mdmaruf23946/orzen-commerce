
-- 1. Table
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  charge numeric(10,2) NOT NULL DEFAULT 0,
  eta text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  courier_code text,
  courier_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX delivery_zones_store_idx ON public.delivery_zones(store_id, sort_order);
CREATE UNIQUE INDEX delivery_zones_one_default_per_store
  ON public.delivery_zones(store_id) WHERE is_default = true;

-- 2. Grants
GRANT SELECT ON public.delivery_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT ALL ON public.delivery_zones TO service_role;

-- 3. RLS
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own zones"
  ON public.delivery_zones FOR ALL
  TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Public can view active zones of active stores"
  ON public.delivery_zones FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active')
  );

-- 4. updated_at trigger (reuse existing tg_touch_updated_at)
CREATE TRIGGER delivery_zones_touch_updated
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 5. orders.delivery_zone_id
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL;

-- 6. Backfill zones from existing stores.delivery JSON
INSERT INTO public.delivery_zones (store_id, name, charge, eta, is_active, is_default, sort_order)
SELECT s.id, 'Inside City',
       COALESCE((s.delivery->>'inside_city')::numeric, 0),
       '1-2 Days', true, true, 0
FROM public.stores s
WHERE (s.delivery->>'inside_city') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.delivery_zones z WHERE z.store_id = s.id);

INSERT INTO public.delivery_zones (store_id, name, charge, eta, is_active, is_default, sort_order)
SELECT s.id, 'Outside City',
       COALESCE((s.delivery->>'outside_city')::numeric, 0),
       '2-4 Days', true, false, 1
FROM public.stores s
WHERE (s.delivery->>'outside_city') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.delivery_zones z
    WHERE z.store_id = s.id AND z.name = 'Outside City'
  );
