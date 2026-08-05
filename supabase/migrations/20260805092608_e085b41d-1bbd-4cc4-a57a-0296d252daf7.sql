ALTER TABLE public.store_invoice_settings
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'physical';

ALTER TABLE public.store_invoice_settings
  DROP CONSTRAINT IF EXISTS store_invoice_settings_order_type_check;
ALTER TABLE public.store_invoice_settings
  ADD CONSTRAINT store_invoice_settings_order_type_check
  CHECK (order_type IN ('physical','digital','service','subscription'));

ALTER TABLE public.store_invoice_settings DROP CONSTRAINT IF EXISTS store_invoice_settings_pkey;
ALTER TABLE public.store_invoice_settings
  ADD CONSTRAINT store_invoice_settings_pkey PRIMARY KEY (store_id, order_type);

-- Seed the three new configurations for every existing store
INSERT INTO public.store_invoice_settings (store_id, order_type, prefix)
SELECT s.id, t.ot, t.px
FROM public.stores s
CROSS JOIN (VALUES ('digital','DG'), ('service','SV'), ('subscription','SUB')) AS t(ot, px)
ON CONFLICT (store_id, order_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.generate_invoice_no(_store_id uuid, _order_type text DEFAULT 'physical')
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s record;
  seq bigint;
  parts text[] := ARRAY[]::text[];
  date_seg text;
  num_seg text;
  invoice text;
  ot text;
  def_prefix text;
BEGIN
  ot := COALESCE(NULLIF(_order_type, ''), 'physical');
  IF ot NOT IN ('physical','digital','service','subscription') THEN ot := 'physical'; END IF;
  def_prefix := CASE ot
    WHEN 'digital' THEN 'DG'
    WHEN 'service' THEN 'SV'
    WHEN 'subscription' THEN 'SUB'
    ELSE 'PH' END;

  INSERT INTO public.store_invoice_settings (store_id, order_type, prefix)
  SELECT _store_id, ot, def_prefix
  FROM public.stores st WHERE st.id = _store_id
  ON CONFLICT (store_id, order_type) DO NOTHING;

  SELECT * INTO s FROM public.store_invoice_settings
    WHERE store_id = _store_id AND order_type = ot FOR UPDATE;

  seq := GREATEST(s.next_number, s.start_number);

  parts := array_append(parts, s.prefix);
  IF s.include_year AND s.include_month THEN
    date_seg := to_char(now(), 'YYYYMM');
    parts := array_append(parts, date_seg);
  ELSIF s.include_year THEN
    date_seg := to_char(now(), 'YYYY');
    parts := array_append(parts, date_seg);
  ELSIF s.include_month THEN
    date_seg := to_char(now(), 'MM');
    parts := array_append(parts, date_seg);
  END IF;

  num_seg := lpad(seq::text, s.padding, '0');
  parts := array_append(parts, num_seg);

  invoice := array_to_string(parts, s.separator);

  UPDATE public.store_invoice_settings
     SET next_number = seq + 1
   WHERE store_id = _store_id AND order_type = ot;

  RETURN invoice;
END $function$;

REVOKE ALL ON FUNCTION public.generate_invoice_no(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_no(uuid, text) TO service_role;

DROP FUNCTION IF EXISTS public.generate_invoice_no(uuid);

CREATE OR REPLACE FUNCTION public.tg_stores_default_invoice_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.store_invoice_settings (store_id, order_type, prefix)
  VALUES
    (NEW.id, 'physical', public._default_invoice_prefix(NEW.name)),
    (NEW.id, 'digital', 'DG'),
    (NEW.id, 'service', 'SV'),
    (NEW.id, 'subscription', 'SUB')
  ON CONFLICT (store_id, order_type) DO NOTHING;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.on_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF NEW.status::text = 'confirmed' AND (OLD.status IS NULL OR OLD.status::text <> 'confirmed') THEN
      IF NEW.invoice_no IS NULL THEN
        NEW.invoice_no := public.generate_invoice_no(NEW.store_id, COALESCE(NEW.order_type, 'physical'));
      END IF;
      FOR it IN SELECT product_id, qty FROM public.order_items WHERE order_id = NEW.id LOOP
        UPDATE public.products SET stock = GREATEST(stock - it.qty, 0) WHERE id = it.product_id;
        INSERT INTO public.stock_movements(store_id, product_id, delta, type, ref_order_id, reason)
        VALUES (NEW.store_id, it.product_id, -it.qty, 'order', NEW.id, 'Order confirmed');
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END $function$;