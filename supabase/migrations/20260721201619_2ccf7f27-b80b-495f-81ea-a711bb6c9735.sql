
CREATE OR REPLACE FUNCTION public.get_public_order(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order jsonb;
  _items jsonb;
  _timeline jsonb;
BEGIN
  SELECT to_jsonb(o) - 'updated_at'
    INTO _order
    FROM (
      SELECT id, customer_name, phone, address, area, payment_method,
             txn_id, subtotal, delivery_amount, discount_amount,
             status, created_at, store_id, invoice_no, notes,
             courier_name, courier_code, courier_tracking_id,
             courier_status, courier_last_synced_at
        FROM public.orders
       WHERE id = _order_id
       LIMIT 1
    ) o;

  IF _order IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'product_id', product_id,
           'name_snapshot', name_snapshot,
           'price_snapshot', price_snapshot,
           'qty', qty
         )), '[]'::jsonb)
    INTO _items
    FROM public.order_items
   WHERE order_id = _order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'stage', stage,
           'note', note,
           'created_at', created_at
         ) ORDER BY created_at), '[]'::jsonb)
    INTO _timeline
    FROM public.order_timeline
   WHERE order_id = _order_id;

  RETURN _order || jsonb_build_object('items', _items, 'timeline', _timeline);
END $function$;
