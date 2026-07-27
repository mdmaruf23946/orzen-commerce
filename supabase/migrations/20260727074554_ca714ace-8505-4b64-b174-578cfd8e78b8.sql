
-- 1. admin_read_cursors table
CREATE TABLE IF NOT EXISTS public.admin_read_cursors (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  feature text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, store_id, feature)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_read_cursors TO authenticated;
GRANT ALL ON public.admin_read_cursors TO service_role;

ALTER TABLE public.admin_read_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arc_owner_all" ON public.admin_read_cursors
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_store_owner(store_id))
  WITH CHECK (user_id = auth.uid() AND public.is_store_owner(store_id));

CREATE INDEX IF NOT EXISTS admin_read_cursors_store_idx
  ON public.admin_read_cursors(store_id, feature);

-- 2. ai_conversations.last_read_at for per-conversation read state
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

-- 3. Realtime publication additions (idempotent)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'orders','returns','store_customers','ai_conversations',
    'low_stock_alerts','admin_notifications','payments',
    'payment_webhook_events','landing_page_logs',
    'store_duplicate_blocks','ai_product_recommendations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
