-- Only physical products should trigger low-stock alerts.
-- Digital/service/subscription products are stockless and should never appear here.

-- 1. Fix the trigger function to skip non-physical products.
CREATE OR REPLACE FUNCTION public.tg_low_stock_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE thr int;
BEGIN
  -- Skip stockless product types entirely
  IF NEW.product_type IS NOT NULL AND NEW.product_type <> 'physical' THEN
    RETURN NEW;
  END IF;

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

-- 2. Resolve any existing open alerts that belong to non-physical products.
UPDATE public.low_stock_alerts
SET resolved_at = now()
WHERE resolved_at IS NULL
  AND product_id IN (
    SELECT id FROM public.products
    WHERE product_type IS NOT NULL AND product_type <> 'physical'
  );