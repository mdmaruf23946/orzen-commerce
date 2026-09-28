ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE INDEX IF NOT EXISTS orders_store_idem_created ON public.orders (store_id, idempotency_key, created_at DESC) WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_chat_order(_store_id uuid, _idem_key text, _order jsonb, _items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _existing record; _it jsonb; _p record; _inv text; _oid uuid;
BEGIN
  IF _idem_key IS NULL OR length(_idem_key) < 16 THEN RAISE EXCEPTION 'invalid_idempotency_key'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_store_id::text || ':' || _idem_key, 0));

  SELECT id, invoice_no INTO _existing FROM orders
   WHERE store_id = _store_id AND idempotency_key = _idem_key AND created_at > now() - interval '30 minutes'
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('id', _existing.id, 'invoice_no', _existing.invoice_no, 'existing', true); END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, stock, status, product_type INTO _p FROM products
     WHERE id = (_it->>'product_id')::uuid AND store_id = _store_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;
    IF coalesce(_p.product_type,'physical') NOT IN ('digital','service','subscription')
       AND coalesce(_p.stock,0) < coalesce((_it->>'qty')::int,1) THEN
      RAISE EXCEPTION 'out_of_stock:%', coalesce(_p.stock,0);
    END IF;
  END LOOP;

  _inv := public.generate_invoice_no(_store_id);
  INSERT INTO orders (store_id, customer_name, phone, email, address, area, payment_method, subtotal,
    delivery_amount, delivery_zone_id, discount_amount, status, invoice_no, notes, customer_id, idempotency_key)
  VALUES (_store_id, _order->>'customer_name', _order->>'phone', nullif(_order->>'email',''), _order->>'address',
    nullif(_order->>'area',''), coalesce(_order->>'payment_method','cod')::payment_method,
    coalesce((_order->>'subtotal')::numeric,0), coalesce((_order->>'delivery_amount')::numeric,0),
    nullif(_order->>'delivery_zone_id','')::uuid, coalesce((_order->>'discount_amount')::numeric,0),
    'pending', _inv, _order->>'notes', nullif(_order->>'customer_id','')::uuid, _idem_key)
  RETURNING id INTO _oid;

  INSERT INTO order_items (order_id, product_id, name_snapshot, price_snapshot, qty)
  SELECT _oid, (e->>'product_id')::uuid, e->>'name', (e->>'price')::numeric, coalesce((e->>'qty')::int,1)
    FROM jsonb_array_elements(_items) e;

  RETURN jsonb_build_object('id', _oid, 'invoice_no', _inv, 'existing', false);
END $$;
REVOKE ALL ON FUNCTION public.create_chat_order(uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_chat_order(uuid, text, jsonb, jsonb) TO service_role;