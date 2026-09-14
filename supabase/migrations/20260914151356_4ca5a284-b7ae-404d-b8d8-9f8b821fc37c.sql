-- ============ 1. Merchant Code ============
CREATE SEQUENCE IF NOT EXISTS public.merchant_code_seq AS bigint START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.format_merchant_code(_n bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  block bigint;
  idx bigint;
  letters text := '';
  b bigint;
  r int;
BEGIN
  IF _n IS NULL OR _n < 1 THEN
    RAISE EXCEPTION 'merchant code sequence must be >= 1';
  END IF;
  block := ((_n - 1) / 999999) + 1;   -- 1 => A, 26 => Z, 27 => AA ...
  idx := ((_n - 1) % 999999) + 1;     -- 1 .. 999999

  b := block;
  WHILE b > 0 LOOP
    r := ((b - 1) % 26)::int;
    letters := chr(65 + r) || letters;
    b := (b - 1) / 26;
  END LOOP;

  RETURN letters || lpad(idx::text, 6, '0');
END $$;

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS merchant_code text;

-- Backfill existing stores in creation order
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.stores WHERE merchant_code IS NULL ORDER BY created_at, id LOOP
    UPDATE public.stores
       SET merchant_code = public.format_merchant_code(nextval('public.merchant_code_seq'))
     WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS stores_merchant_code_key ON public.stores (merchant_code);
ALTER TABLE public.stores ALTER COLUMN merchant_code SET NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_store_merchant_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.merchant_code := public.format_merchant_code(nextval('public.merchant_code_seq'));
  ELSE
    -- permanent: never changes once assigned
    NEW.merchant_code := OLD.merchant_code;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS stores_merchant_code_ins ON public.stores;
CREATE TRIGGER stores_merchant_code_ins
BEFORE INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.tg_store_merchant_code();

DROP TRIGGER IF EXISTS stores_merchant_code_upd ON public.stores;
CREATE TRIGGER stores_merchant_code_upd
BEFORE UPDATE OF merchant_code ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.tg_store_merchant_code();

-- ============ 2. Customer Code ============
CREATE TABLE IF NOT EXISTS public.store_customer_counters (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  next_no bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.store_customer_counters TO service_role;
ALTER TABLE public.store_customer_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.store_customer_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.store_customers ADD COLUMN IF NOT EXISTS customer_code text;

-- Backfill existing customers per store, in signup order
DO $$
DECLARE s record; c record; n bigint; mcode text;
BEGIN
  FOR s IN SELECT id, merchant_code FROM public.stores LOOP
    n := 1;
    mcode := s.merchant_code;
    FOR c IN SELECT id FROM public.store_customers
              WHERE store_id = s.id AND customer_code IS NULL
              ORDER BY created_at, id LOOP
      UPDATE public.store_customers
         SET customer_code = mcode || '-C' || lpad(n::text, 6, '0')
       WHERE id = c.id;
      n := n + 1;
    END LOOP;
    INSERT INTO public.store_customer_counters (store_id, next_no)
    VALUES (s.id, n)
    ON CONFLICT (store_id) DO UPDATE SET next_no = GREATEST(public.store_customer_counters.next_no, EXCLUDED.next_no);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS store_customers_code_key
  ON public.store_customers (store_id, customer_code);

CREATE OR REPLACE FUNCTION public.tg_store_customer_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE mcode text; n bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.customer_code := OLD.customer_code;
    RETURN NEW;
  END IF;

  SELECT merchant_code INTO mcode FROM public.stores WHERE id = NEW.store_id;
  IF mcode IS NULL THEN
    NEW.customer_code := NULL;
    RETURN NEW;
  END IF;

  INSERT INTO public.store_customer_counters (store_id, next_no)
  VALUES (NEW.store_id, 1)
  ON CONFLICT (store_id) DO NOTHING;

  UPDATE public.store_customer_counters
     SET next_no = next_no + 1, updated_at = now()
   WHERE store_id = NEW.store_id
   RETURNING next_no - 1 INTO n;

  NEW.customer_code := mcode || '-C' || lpad(n::text, 6, '0');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS store_customers_code_ins ON public.store_customers;
CREATE TRIGGER store_customers_code_ins
BEFORE INSERT ON public.store_customers
FOR EACH ROW EXECUTE FUNCTION public.tg_store_customer_code();

DROP TRIGGER IF EXISTS store_customers_code_upd ON public.store_customers;
CREATE TRIGGER store_customers_code_upd
BEFORE UPDATE OF customer_code ON public.store_customers
FOR EACH ROW EXECUTE FUNCTION public.tg_store_customer_code();

-- ============ 3. Isolation hardening ============
CREATE OR REPLACE FUNCTION public.get_store_bestsellers(_store_id uuid, _limit integer DEFAULT 12)
RETURNS TABLE(product_id uuid, total_qty bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT oi.product_id, SUM(oi.qty)::bigint AS total_qty
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.products p ON p.id = oi.product_id
   WHERE o.store_id = _store_id
     AND p.store_id = _store_id
     AND p.status = 'active'
     AND o.status <> 'cancelled'
     AND (public.has_store_access(_store_id) OR public.is_store_active(_store_id))
   GROUP BY oi.product_id
   ORDER BY total_qty DESC
   LIMIT GREATEST(1, LEAST(COALESCE(_limit, 12), 24))
$$;

CREATE OR REPLACE FUNCTION public.refresh_store_subscription_status(_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE free_id uuid;
BEGIN
  -- Tenant guard: signed-in callers may only refresh a store they belong to.
  IF auth.uid() IS NOT NULL AND NOT public.has_store_access(_store_id) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.stores
     WHERE id = _store_id
       AND subscription_status IN ('trialing','active')
       AND expires_at IS NOT NULL
       AND expires_at < now()
  ) THEN
    SELECT id INTO free_id
      FROM public.subscription_packages
     WHERE is_active = true AND is_trial = false AND plan_tier = 'free'
     ORDER BY price ASC LIMIT 1;

    UPDATE public.stores
       SET subscription_status = 'expired',
           package_id = COALESCE(free_id, package_id)
     WHERE id = _store_id;
  END IF;
END $$;