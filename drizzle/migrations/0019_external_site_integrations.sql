-- External website integrations: isolated catalog mirror + two-way order status sync (event-driven, no polling).
ALTER TABLE public.landing_page_connections
  ADD COLUMN IF NOT EXISTS site_type text NOT NULL DEFAULT 'landing_page',
  ADD COLUMN IF NOT EXISTS outbound_webhook_url text,
  ADD COLUMN IF NOT EXISTS site_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_catalog_sync_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.landing_page_connections
    ADD CONSTRAINT lpc_site_type_chk CHECK (site_type IN ('landing_page','website'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.external_site_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.landing_page_connections(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  parent_external_id text,
  image_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_id)
);
GRANT SELECT ON public.external_site_categories TO authenticated;
GRANT ALL ON public.external_site_categories TO service_role;
ALTER TABLE public.external_site_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store team reads external categories" ON public.external_site_categories
  FOR SELECT TO authenticated USING (public.has_store_access(store_id));

CREATE TABLE IF NOT EXISTS public.external_site_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.landing_page_connections(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  sku text,
  price numeric NOT NULL DEFAULT 0,
  sale_price numeric,
  stock integer,
  description text,
  image_url text,
  product_url text,
  category_external_id text,
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_esp_conn_cat ON public.external_site_products (connection_id, category_external_id);
GRANT SELECT ON public.external_site_products TO authenticated;
GRANT ALL ON public.external_site_products TO service_role;
ALTER TABLE public.external_site_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store team reads external products" ON public.external_site_products
  FOR SELECT TO authenticated USING (public.has_store_access(store_id));

CREATE TABLE IF NOT EXISTS public.external_site_sync_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.landing_page_connections(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  response_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_esso_due ON public.external_site_sync_outbox (status, run_at);
CREATE INDEX IF NOT EXISTS idx_esso_conn ON public.external_site_sync_outbox (connection_id, created_at DESC);
GRANT SELECT ON public.external_site_sync_outbox TO authenticated;
GRANT ALL ON public.external_site_sync_outbox TO service_role;
ALTER TABLE public.external_site_sync_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store team reads sync outbox" ON public.external_site_sync_outbox
  FOR SELECT TO authenticated USING (public.has_store_access(store_id));

CREATE OR REPLACE FUNCTION public.tg_external_site_order_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF NEW.landing_page_connection_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.courier_status IS NOT DISTINCT FROM OLD.courier_status
     AND NEW.courier_tracking_id IS NOT DISTINCT FROM OLD.courier_tracking_id
     AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN
    RETURN NEW;
  END IF;
  SELECT id, outbound_webhook_url, status INTO c FROM public.landing_page_connections
   WHERE id = NEW.landing_page_connection_id;
  IF NOT FOUND OR coalesce(c.outbound_webhook_url, '') = '' OR c.status <> 'active' THEN RETURN NEW; END IF;
  INSERT INTO public.external_site_sync_outbox (store_id, connection_id, order_id, event, payload)
  VALUES (NEW.store_id, c.id, NEW.id,
    CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'order.status_changed' ELSE 'order.updated' END,
    jsonb_build_object(
      'order_id', NEW.id, 'invoice_no', NEW.invoice_no, 'external_order_id', NEW.external_order_id,
      'status', NEW.status, 'previous_status', OLD.status,
      'payment_status', NEW.payment_status,
      'courier_name', NEW.courier_name, 'courier_status', NEW.courier_status,
      'tracking_id', NEW.courier_tracking_id, 'updated_at', now()));
  BEGIN
    PERFORM net.http_post(
      url := 'https://orzen.top/api/public/external-sites/dispatch',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := '{}'::jsonb, timeout_milliseconds := 15000);
  EXCEPTION WHEN others THEN NULL; END;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_external_site_order_sync() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_orders_external_site_sync ON public.orders;
CREATE TRIGGER t_orders_external_site_sync AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_external_site_order_sync();