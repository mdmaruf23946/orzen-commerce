
-- Add handoff_reason and handoff_at to ai_conversations
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS handoff_reason text,
  ADD COLUMN IF NOT EXISTS handoff_at timestamptz;

-- AI product recommendations log
CREATE TABLE IF NOT EXISTS public.ai_product_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  context text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_prod_recs_store_created_idx ON public.ai_product_recommendations(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_prod_recs_conv_idx ON public.ai_product_recommendations(conversation_id);

GRANT SELECT ON public.ai_product_recommendations TO authenticated;
GRANT ALL ON public.ai_product_recommendations TO service_role;
ALTER TABLE public.ai_product_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own ai recs" ON public.ai_product_recommendations
  FOR SELECT TO authenticated USING (public.is_store_owner(store_id));

-- AI product blacklist
CREATE TABLE IF NOT EXISTS public.ai_product_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, product_id)
);
GRANT SELECT, INSERT, DELETE ON public.ai_product_blacklist TO authenticated;
GRANT ALL ON public.ai_product_blacklist TO service_role;
ALTER TABLE public.ai_product_blacklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own blacklist" ON public.ai_product_blacklist
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- Low stock alerts
CREATE TABLE IF NOT EXISTS public.low_stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  current_stock integer NOT NULL,
  threshold integer NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS low_stock_store_open_idx ON public.low_stock_alerts(store_id) WHERE resolved_at IS NULL;

GRANT SELECT, UPDATE ON public.low_stock_alerts TO authenticated;
GRANT ALL ON public.low_stock_alerts TO service_role;
ALTER TABLE public.low_stock_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own low stock" ON public.low_stock_alerts
  FOR SELECT TO authenticated USING (public.is_store_owner(store_id));
CREATE POLICY "owners resolve own low stock" ON public.low_stock_alerts
  FOR UPDATE TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- Trigger to insert low stock alerts
CREATE OR REPLACE FUNCTION public.tg_low_stock_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE thr int;
BEGIN
  thr := COALESCE(NEW.low_stock_threshold, 5);
  IF NEW.stock <= thr AND (OLD.stock IS NULL OR OLD.stock > thr) THEN
    INSERT INTO public.low_stock_alerts(store_id, product_id, current_stock, threshold)
    VALUES (NEW.store_id, NEW.id, NEW.stock, thr);
  ELSIF NEW.stock > thr AND OLD.stock IS NOT NULL AND OLD.stock <= thr THEN
    UPDATE public.low_stock_alerts SET resolved_at = now()
      WHERE product_id = NEW.id AND resolved_at IS NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_products_low_stock ON public.products;
CREATE TRIGGER tg_products_low_stock
  AFTER INSERT OR UPDATE OF stock, low_stock_threshold ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_low_stock_check();

-- Realtime for low stock alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.low_stock_alerts;
