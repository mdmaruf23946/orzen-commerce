CREATE OR REPLACE FUNCTION public.tg_stores_default_invoice_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix text := public._default_invoice_prefix(NEW.name);
BEGIN
  INSERT INTO public.store_invoice_settings (store_id, order_type, prefix)
  VALUES
    (NEW.id, 'physical', _prefix),
    (NEW.id, 'digital', _prefix),
    (NEW.id, 'service', _prefix),
    (NEW.id, 'subscription', _prefix)
  ON CONFLICT (store_id, order_type) DO NOTHING;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_stores_default_invoice_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_stores_default_invoice_settings() TO service_role;