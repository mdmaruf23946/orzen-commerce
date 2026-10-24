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
      -- Items without a store product (external website products, deleted products) hold no local stock.
      FOR it IN SELECT product_id, qty FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL LOOP
        UPDATE public.products SET stock = GREATEST(stock - it.qty, 0) WHERE id = it.product_id;
        INSERT INTO public.stock_movements(store_id, product_id, delta, type, ref_order_id, reason)
        VALUES (NEW.store_id, it.product_id, -it.qty, 'order', NEW.id, 'Order confirmed');
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END $function$;