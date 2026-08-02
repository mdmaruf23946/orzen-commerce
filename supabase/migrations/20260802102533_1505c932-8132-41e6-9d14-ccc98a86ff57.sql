ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfillment_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_type_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_order_type_check
      CHECK (order_type IN ('physical','digital','service','subscription'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_confirmation_status_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_confirmation_status_check
      CHECK (confirmation_status IN ('pending','confirmed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_store_order_type_idx ON public.orders (store_id, order_type);

-- Backfill order_type from the products in each order (mixed carts stay physical).
WITH types AS (
  SELECT oi.order_id, array_agg(DISTINCT p.product_type::text) AS kinds
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
   GROUP BY oi.order_id
)
UPDATE public.orders o
   SET order_type = t.kinds[1]
  FROM types t
 WHERE t.order_id = o.id
   AND array_length(t.kinds, 1) = 1
   AND t.kinds[1] IN ('digital','service','subscription');

-- Existing non-physical orders that are already delivered/confirmed count as confirmed.
UPDATE public.orders
   SET confirmation_status = 'confirmed', confirmed_at = COALESCE(confirmed_at, updated_at, created_at)
 WHERE order_type <> 'physical'
   AND status::text IN ('confirmed','processing','delivered');

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS order_confirmation jsonb NOT NULL
  DEFAULT '{"digital":"auto","service":"manual","subscription":"manual"}'::jsonb;

ALTER TABLE public.store_template
  ADD COLUMN IF NOT EXISTS order_confirmation jsonb NOT NULL
  DEFAULT '{"digital":"auto","service":"manual","subscription":"manual"}'::jsonb;