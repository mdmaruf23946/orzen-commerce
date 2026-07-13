-- 1. Remove the enumeration-allowing policies
DROP POLICY IF EXISTS "orders public read by id" ON public.orders;
DROP POLICY IF EXISTS "order items public read" ON public.order_items;

-- 2. Safe single-order lookup (by known UUID) for confirmation page
CREATE OR REPLACE FUNCTION public.get_public_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order jsonb;
  _items jsonb;
BEGIN
  SELECT to_jsonb(o) - 'updated_at'
    INTO _order
    FROM (
      SELECT id, customer_name, phone, address, area, payment_method,
             txn_id, subtotal, delivery_amount, discount_amount,
             status, created_at, store_id, invoice_no, notes
        FROM public.orders
       WHERE id = _order_id
       LIMIT 1
    ) o;

  IF _order IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'name_snapshot', name_snapshot,
           'price_snapshot', price_snapshot,
           'qty', qty
         )), '[]'::jsonb)
    INTO _items
    FROM public.order_items
   WHERE order_id = _order_id;

  RETURN _order || jsonb_build_object('items', _items);
END $$;

GRANT EXECUTE ON FUNCTION public.get_public_order(uuid) TO anon, authenticated;

-- 3. Safe best-sellers aggregate per store (no PII exposure)
CREATE OR REPLACE FUNCTION public.get_store_bestsellers(_store_id uuid, _limit int DEFAULT 12)
RETURNS TABLE(product_id uuid, total_qty bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.product_id, SUM(oi.qty)::bigint AS total_qty
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
   WHERE o.store_id = _store_id
     AND o.status <> 'cancelled'
     AND oi.product_id IS NOT NULL
   GROUP BY oi.product_id
   ORDER BY total_qty DESC
   LIMIT GREATEST(1, LEAST(COALESCE(_limit, 12), 24))
$$;

GRANT EXECUTE ON FUNCTION public.get_store_bestsellers(uuid, int) TO anon, authenticated;