ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS customer_note text;

DROP FUNCTION IF EXISTS public.customer_create_return(text,uuid,uuid,text,text,jsonb,text[],text);

CREATE OR REPLACE FUNCTION public.customer_create_return(
  _token text,
  _store_id uuid,
  _order_id uuid,
  _type text,
  _reason text,
  _items jsonb,
  _images text[],
  _replacement_note text,
  _note text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cust jsonb;
  _cid uuid;
  _order record;
  _existing uuid;
  _new uuid;
BEGIN
  _cust := public.customer_from_token(_token, _store_id);
  IF _cust IS NULL OR (_cust->>'id') IS NULL THEN
    RETURN jsonb_build_object('error', 'Please sign in to request a return');
  END IF;
  _cid := (_cust->>'id')::uuid;

  SELECT * INTO _order FROM public.orders
   WHERE id = _order_id AND store_id = _store_id AND customer_id = _cid;
  IF _order IS NULL THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;
  IF _order.status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'Cancelled orders are not eligible');
  END IF;

  SELECT id INTO _existing FROM public.returns
   WHERE order_id = _order_id AND status IN ('requested','approved')
   LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'A request is already open for this order');
  END IF;

  INSERT INTO public.returns (
    store_id, order_id, customer_id, customer_name, phone,
    type, reason, status, items, images, replacement_note, customer_note
  ) VALUES (
    _store_id, _order_id, _cid, _order.customer_name, _order.phone,
    _type::return_type, NULLIF(_reason,''), 'requested',
    COALESCE(_items, '[]'::jsonb), COALESCE(_images, '{}'::text[]),
    NULLIF(_replacement_note,''), NULLIF(_note,'')
  ) RETURNING id INTO _new;

  RETURN jsonb_build_object('id', _new);
END;
$$;

REVOKE ALL ON FUNCTION public.customer_create_return(text,uuid,uuid,text,text,jsonb,text[],text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_create_return(text,uuid,uuid,text,text,jsonb,text[],text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.customer_list_returns(_token text, _store_id uuid, _order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cust jsonb;
  _cid uuid;
  _rows jsonb;
BEGIN
  _cust := public.customer_from_token(_token, _store_id);
  IF _cust IS NULL OR (_cust->>'id') IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  _cid := (_cust->>'id')::uuid;
  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'created_at' DESC), '[]'::jsonb) INTO _rows
    FROM (
      SELECT to_jsonb(r) || jsonb_build_object(
        'replacement_product',
        CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', p.id, 'name', p.name, 'image', p.primary_image_url
        ) END
      ) AS row
        FROM public.returns r
        LEFT JOIN public.products p ON p.id = r.replacement_product_id
       WHERE r.store_id = _store_id AND r.customer_id = _cid
         AND (_order_id IS NULL OR r.order_id = _order_id)
    ) s;
  RETURN _rows;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_list_returns(text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_list_returns(text,uuid,uuid) TO service_role;