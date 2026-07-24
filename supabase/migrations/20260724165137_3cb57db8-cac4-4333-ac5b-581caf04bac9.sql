
-- 1. Table
CREATE TABLE IF NOT EXISTS public.store_invoice_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  prefix text NOT NULL DEFAULT 'ST' CHECK (char_length(prefix) BETWEEN 1 AND 10 AND prefix ~ '^[A-Z0-9]+$'),
  separator text NOT NULL DEFAULT '-' CHECK (separator IN ('-', '/', '_', '')),
  padding smallint NOT NULL DEFAULT 6 CHECK (padding BETWEEN 4 AND 8),
  start_number bigint NOT NULL DEFAULT 1 CHECK (start_number >= 1),
  include_year boolean NOT NULL DEFAULT false,
  include_month boolean NOT NULL DEFAULT false,
  next_number bigint NOT NULL DEFAULT 1 CHECK (next_number >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.store_invoice_settings TO authenticated;
GRANT ALL ON public.store_invoice_settings TO service_role;

ALTER TABLE public.store_invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_settings_owner_select"
  ON public.store_invoice_settings FOR SELECT
  TO authenticated
  USING (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "invoice_settings_owner_insert"
  ON public.store_invoice_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "invoice_settings_owner_update"
  ON public.store_invoice_settings FOR UPDATE
  TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE TRIGGER trg_invoice_settings_touch
  BEFORE UPDATE ON public.store_invoice_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 2. Unique invoice_no per store
CREATE UNIQUE INDEX IF NOT EXISTS orders_store_invoice_no_uniq
  ON public.orders (store_id, invoice_no)
  WHERE invoice_no IS NOT NULL;

-- 3. Helper: derive default prefix from store name
CREATE OR REPLACE FUNCTION public._default_invoice_prefix(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(substring(upper(regexp_replace(coalesce(_name, ''), '[^A-Za-z]', '', 'g')) FROM 1 FOR 2), ''),
    'ST'
  );
$$;

-- 4. Auto-provision defaults on new stores
CREATE OR REPLACE FUNCTION public.tg_stores_default_invoice_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_invoice_settings (store_id, prefix)
  VALUES (NEW.id, public._default_invoice_prefix(NEW.name))
  ON CONFLICT (store_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stores_default_invoice_settings ON public.stores;
CREATE TRIGGER trg_stores_default_invoice_settings
  AFTER INSERT ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.tg_stores_default_invoice_settings();

-- 5. Backfill for existing stores
INSERT INTO public.store_invoice_settings (store_id, prefix)
SELECT s.id, public._default_invoice_prefix(s.name)
FROM public.stores s
LEFT JOIN public.store_invoice_settings si ON si.store_id = s.id
WHERE si.store_id IS NULL;

-- 6. Replace generate_invoice_no
CREATE OR REPLACE FUNCTION public.generate_invoice_no(_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  seq bigint;
  parts text[] := ARRAY[]::text[];
  date_seg text;
  num_seg text;
  invoice text;
BEGIN
  -- Ensure a settings row exists (defensive)
  INSERT INTO public.store_invoice_settings (store_id, prefix)
  SELECT _store_id, public._default_invoice_prefix(st.name)
  FROM public.stores st WHERE st.id = _store_id
  ON CONFLICT (store_id) DO NOTHING;

  SELECT * INTO s FROM public.store_invoice_settings
    WHERE store_id = _store_id FOR UPDATE;

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
   WHERE store_id = _store_id;

  RETURN invoice;
END $$;

REVOKE ALL ON FUNCTION public.generate_invoice_no(uuid) FROM PUBLIC, anon, authenticated;
