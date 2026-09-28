CREATE OR REPLACE FUNCTION public.tg_order_items_stock_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _stock int; _type text; _status text; _reserved int;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  SELECT status::text INTO _status FROM orders WHERE id = NEW.order_id;
  IF _status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  SELECT stock, coalesce(product_type,'physical') INTO _stock, _type FROM products WHERE id = NEW.product_id FOR UPDATE;
  IF NOT FOUND OR _type IN ('digital','service','subscription') THEN RETURN NEW; END IF;
  SELECT coalesce(sum(oi.qty),0) INTO _reserved
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
   WHERE oi.product_id = NEW.product_id AND o.status = 'pending'
     AND o.created_at > now() - interval '24 hours' AND oi.order_id <> NEW.order_id;
  IF coalesce(_stock,0) - _reserved < coalesce(NEW.qty,1) THEN
    RAISE EXCEPTION 'out_of_stock:%', GREATEST(coalesce(_stock,0) - _reserved, 0);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_order_items_stock_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS order_items_stock_guard ON public.order_items;
CREATE TRIGGER order_items_stock_guard BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.tg_order_items_stock_guard();