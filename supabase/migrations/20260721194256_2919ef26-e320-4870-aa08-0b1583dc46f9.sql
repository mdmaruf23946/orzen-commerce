
-- ============ Phase 1: Product knowledge fields ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS product_code text,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS delivery_charge numeric,
  ADD COLUMN IF NOT EXISTS delivery_time_days text,
  ADD COLUMN IF NOT EXISTS rating numeric,
  ADD COLUMN IF NOT EXISTS total_sold integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS related_product_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE INDEX IF NOT EXISTS products_store_brand_idx ON public.products (store_id, brand);
CREATE INDEX IF NOT EXISTS products_store_category_status_idx ON public.products (store_id, category_id, status);

-- ============ Phase 6: Order courier tracking ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_code text,
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS courier_tracking_id text,
  ADD COLUMN IF NOT EXISTS courier_status text,
  ADD COLUMN IF NOT EXISTS courier_last_synced_at timestamptz;

-- ============ Phase 9: Customer memory ============
ALTER TABLE public.store_customers
  ADD COLUMN IF NOT EXISTS ai_memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_language text;

-- ============ Phase 10: Admin notifications ============
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store owner reads admin_notifications" ON public.admin_notifications;
CREATE POLICY "store owner reads admin_notifications"
  ON public.admin_notifications FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

DROP POLICY IF EXISTS "store owner updates admin_notifications" ON public.admin_notifications;
CREATE POLICY "store owner updates admin_notifications"
  ON public.admin_notifications FOR UPDATE TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE INDEX IF NOT EXISTS admin_notifications_store_created_idx
  ON public.admin_notifications (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_store_unread_idx
  ON public.admin_notifications (store_id) WHERE read_at IS NULL;

-- ============ Phase 5: Order notification outbox ============
CREATE TABLE IF NOT EXISTS public.order_notifications_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'messenger',
  stage text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  error text,
  attempt_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_notifications_outbox TO authenticated;
GRANT ALL ON public.order_notifications_outbox TO service_role;

ALTER TABLE public.order_notifications_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store owner reads outbox" ON public.order_notifications_outbox;
CREATE POLICY "store owner reads outbox"
  ON public.order_notifications_outbox FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

CREATE INDEX IF NOT EXISTS order_outbox_pending_idx
  ON public.order_notifications_outbox (created_at) WHERE sent_at IS NULL;

-- Trigger: enqueue notification whenever a timeline row is added
CREATE OR REPLACE FUNCTION public.enqueue_order_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.order_notifications_outbox(order_id, store_id, stage)
  VALUES (NEW.order_id, NEW.store_id, NEW.stage::text);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_timeline_notify ON public.order_timeline;
CREATE TRIGGER trg_order_timeline_notify
AFTER INSERT ON public.order_timeline
FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_notification();

-- Helper: mark stock movement for AI-created orders when placed (pre-reserve)
-- We rely on existing on_order_status_change trigger to decrement on confirm.
