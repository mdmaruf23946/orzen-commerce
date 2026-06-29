
-- Enums
CREATE TYPE public.stock_movement_type AS ENUM ('order','manual_in','manual_out','return','adjustment');
CREATE TYPE public.coupon_type AS ENUM ('percent','fixed','free_shipping');
CREATE TYPE public.expense_category AS ENUM ('fb_ads','courier','packaging','salary','misc');
CREATE TYPE public.return_type AS ENUM ('return','exchange');
CREATE TYPE public.return_status AS ENUM ('requested','approved','rejected','refunded','completed');
CREATE TYPE public.order_stage AS ENUM ('placed','confirmed','packed','courier_assigned','shipped','delivered','returned','cancelled');

-- Column additions
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sku text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id uuid,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_no text;

-- Helper: is current user the owner of this store?
CREATE OR REPLACE FUNCTION public.is_store_owner(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_user_id = auth.uid()) $$;

-- stock_movements
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  type public.stock_movement_type NOT NULL,
  reason text,
  ref_order_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_store_created ON public.stock_movements(store_id, created_at DESC);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages stock movements" ON public.stock_movements
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- coupons
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  type public.coupon_type NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT SELECT ON public.coupons TO anon;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages coupons" ON public.coupons
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE POLICY "public reads active coupons" ON public.coupons
  FOR SELECT TO anon, authenticated USING (active = true);
CREATE TRIGGER trg_coupons_updated BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- coupon_redemptions
CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid,
  customer_phone text,
  discount_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coupon_redemptions_store ON public.coupon_redemptions(store_id, created_at DESC);
GRANT SELECT, INSERT ON public.coupon_redemptions TO authenticated;
GRANT INSERT ON public.coupon_redemptions TO anon;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (public.is_store_owner(store_id));
CREATE POLICY "checkout inserts redemptions" ON public.coupon_redemptions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category public.expense_category NOT NULL,
  amount numeric NOT NULL,
  note text,
  spent_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_store_date ON public.expenses(store_id, spent_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages expenses" ON public.expenses
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- returns
CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  type public.return_type NOT NULL DEFAULT 'return',
  reason text,
  status public.return_status NOT NULL DEFAULT 'requested',
  refund_amount numeric DEFAULT 0,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_returns_store ON public.returns(store_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages returns" ON public.returns
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_returns_updated BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- order_timeline
CREATE TABLE public.order_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  stage public.order_stage NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_timeline_order ON public.order_timeline(order_id, created_at);
GRANT SELECT, INSERT ON public.order_timeline TO authenticated;
GRANT ALL ON public.order_timeline TO service_role;
ALTER TABLE public.order_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads timeline" ON public.order_timeline
  FOR SELECT TO authenticated USING (public.is_store_owner(store_id));
CREATE POLICY "owner writes timeline" ON public.order_timeline
  FOR INSERT TO authenticated WITH CHECK (public.is_store_owner(store_id));

-- customer_notes
CREATE TABLE public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, customer_phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages customer notes" ON public.customer_notes
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_customer_notes_updated BEFORE UPDATE ON public.customer_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- order_internal_notes
CREATE TABLE public.order_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_internal_notes_order ON public.order_internal_notes(order_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_internal_notes TO authenticated;
GRANT ALL ON public.order_internal_notes TO service_role;
ALTER TABLE public.order_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages internal notes" ON public.order_internal_notes
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- Invoice number sequence per store/month
CREATE OR REPLACE FUNCTION public.generate_invoice_no(_store_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prefix text; seq int;
BEGIN
  prefix := to_char(now(), 'YYYYMM');
  SELECT COALESCE(MAX((regexp_replace(invoice_no, '^INV-'||prefix||'-', ''))::int), 0) + 1
    INTO seq FROM public.orders
   WHERE store_id = _store_id AND invoice_no LIKE 'INV-'||prefix||'-%';
  RETURN 'INV-'||prefix||'-'||lpad(seq::text, 4, '0');
END $$;

-- Trigger: order status transitions write timeline + invoice + stock decrement on confirm
CREATE OR REPLACE FUNCTION public.on_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE stg public.order_stage; it record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_timeline(order_id, store_id, stage) VALUES (NEW.id, NEW.store_id, 'placed');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    stg := CASE NEW.status::text
      WHEN 'confirmed' THEN 'confirmed'::public.order_stage
      WHEN 'processing' THEN 'packed'::public.order_stage
      WHEN 'delivered' THEN 'delivered'::public.order_stage
      WHEN 'cancelled' THEN 'cancelled'::public.order_stage
      ELSE NULL END;
    IF stg IS NOT NULL THEN
      INSERT INTO public.order_timeline(order_id, store_id, stage) VALUES (NEW.id, NEW.store_id, stg);
    END IF;
    -- On confirm: assign invoice no + decrement stock + record movements
    IF NEW.status::text = 'confirmed' AND (OLD.status IS NULL OR OLD.status::text <> 'confirmed') THEN
      IF NEW.invoice_no IS NULL THEN
        NEW.invoice_no := public.generate_invoice_no(NEW.store_id);
      END IF;
      FOR it IN SELECT product_id, qty FROM public.order_items WHERE order_id = NEW.id LOOP
        UPDATE public.products SET stock = GREATEST(stock - it.qty, 0) WHERE id = it.product_id;
        INSERT INTO public.stock_movements(store_id, product_id, delta, type, ref_order_id, reason)
        VALUES (NEW.store_id, it.product_id, -it.qty, 'order', NEW.id, 'Order confirmed');
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_order_insert AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_status_change();
CREATE TRIGGER trg_order_status BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_status_change();
