-- 1. New lifecycle stages
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'shipment_created';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'in_transit';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'received';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'inspection_passed';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'inspection_failed';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'replacement_created';
ALTER TYPE public.return_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 2. returns: workflow + financial columns
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS request_kind text NOT NULL DEFAULT 'return',
  ADD COLUMN IF NOT EXISTS replacement_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS items_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replacement_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_shipping_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replacement_shipping_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS restocking_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_payment_due numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_method text,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS inspected_at timestamptz,
  ADD COLUMN IF NOT EXISTS inspection_note text,
  ADD COLUMN IF NOT EXISTS replacement_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS courier_parcel_id uuid REFERENCES public.courier_parcels(id) ON DELETE SET NULL;

ALTER TABLE public.store_customers
  ADD COLUMN IF NOT EXISTS store_credit numeric NOT NULL DEFAULT 0;

-- 3. Per-store return policy
CREATE TABLE IF NOT EXISTS public.store_return_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  eligibility_days integer NOT NULL DEFAULT 7,
  allow_return boolean NOT NULL DEFAULT true,
  allow_exchange_same boolean NOT NULL DEFAULT true,
  allow_exchange_other boolean NOT NULL DEFAULT true,
  return_shipping_payer text NOT NULL DEFAULT 'customer',
  return_shipping_charge numeric NOT NULL DEFAULT 0,
  replacement_shipping_payer text NOT NULL DEFAULT 'store',
  replacement_shipping_charge numeric NOT NULL DEFAULT 0,
  restocking_fee_type text NOT NULL DEFAULT 'none',
  restocking_fee_value numeric NOT NULL DEFAULT 0,
  refund_methods text[] NOT NULL DEFAULT ARRAY['original','store_credit','manual']::text[],
  auto_approve_under numeric,
  require_inspection boolean NOT NULL DEFAULT true,
  policy_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_return_settings TO authenticated;
GRANT ALL ON public.store_return_settings TO service_role;
ALTER TABLE public.store_return_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner manages return settings" ON public.store_return_settings;
CREATE POLICY "owner manages return settings" ON public.store_return_settings
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_store_return_settings_touch BEFORE UPDATE ON public.store_return_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 4. Return line items
CREATE TABLE IF NOT EXISTS public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  variant text,
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  image_url text,
  inspection_result text,
  restocked_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON public.return_items(return_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_items TO authenticated;
GRANT ALL ON public.return_items TO service_role;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner manages return items" ON public.return_items;
CREATE POLICY "owner manages return items" ON public.return_items
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- 5. Timeline
CREATE TABLE IF NOT EXISTS public.return_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  actor text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_return_timeline_return ON public.return_timeline(return_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_timeline TO authenticated;
GRANT ALL ON public.return_timeline TO service_role;
ALTER TABLE public.return_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner manages return timeline" ON public.return_timeline;
CREATE POLICY "owner manages return timeline" ON public.return_timeline
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- 6. Public policy read for the storefront wizard
CREATE OR REPLACE FUNCTION public.get_public_return_settings(_store_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'enabled', COALESCE(s.enabled, true),
    'eligibility_days', COALESCE(s.eligibility_days, 7),
    'allow_return', COALESCE(s.allow_return, true),
    'allow_exchange_same', COALESCE(s.allow_exchange_same, true),
    'allow_exchange_other', COALESCE(s.allow_exchange_other, true),
    'return_shipping_payer', COALESCE(s.return_shipping_payer, 'customer'),
    'return_shipping_charge', COALESCE(s.return_shipping_charge, 0),
    'replacement_shipping_payer', COALESCE(s.replacement_shipping_payer, 'store'),
    'replacement_shipping_charge', COALESCE(s.replacement_shipping_charge, 0),
    'restocking_fee_type', COALESCE(s.restocking_fee_type, 'none'),
    'restocking_fee_value', COALESCE(s.restocking_fee_value, 0),
    'policy_note', s.policy_note
  )
  FROM public.stores st
  LEFT JOIN public.store_return_settings s ON s.store_id = st.id
  WHERE st.id = _store_id AND st.status = 'active'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_return_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_return_settings(uuid) TO service_role;

-- 7. Customer-facing detail read (token validated)
CREATE OR REPLACE FUNCTION public.customer_list_returns_v2(_token text, _store_id uuid, _order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _cust jsonb; _cid uuid;
BEGIN
  _cust := public.customer_from_token(_token, _store_id);
  IF _cust IS NULL OR (_cust->>'id') IS NULL THEN RETURN '[]'::jsonb; END IF;
  _cid := (_cust->>'id')::uuid;
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(r) || jsonb_build_object(
      'lines', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', ri.id, 'name', ri.name, 'variant', ri.variant, 'qty', ri.qty,
          'unit_price', ri.unit_price, 'image_url', ri.image_url,
          'inspection_result', ri.inspection_result
        ) ORDER BY ri.created_at) FROM public.return_items ri WHERE ri.return_id = r.id), '[]'::jsonb),
      'timeline', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'status', t.status, 'note', t.note, 'created_at', t.created_at
        ) ORDER BY t.created_at) FROM public.return_timeline t WHERE t.return_id = r.id), '[]'::jsonb),
      'replacement_order', CASE WHEN ro.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', ro.id, 'invoice_no', ro.invoice_no, 'status', ro.status,
        'courier_tracking_id', ro.courier_tracking_id, 'courier_name', ro.courier_name
      ) END,
      'replacement_product', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', p.id, 'name', p.name, 'image', p.primary_image_url) END
    ) ORDER BY r.created_at DESC)
    FROM public.returns r
    LEFT JOIN public.orders ro ON ro.id = r.replacement_order_id
    LEFT JOIN public.products p ON p.id = r.replacement_product_id
    WHERE r.store_id = _store_id AND r.customer_id = _cid
      AND (_order_id IS NULL OR r.order_id = _order_id)
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.customer_list_returns_v2(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_list_returns_v2(text, uuid, uuid) TO service_role;

-- 8. Customer request creation with lines, replacement selection and locked money
CREATE OR REPLACE FUNCTION public.customer_create_return_v2(
  _token text, _store_id uuid, _order_id uuid,
  _kind text, _type text, _reason text, _note text,
  _lines jsonb, _replacement_items jsonb, _images text[], _amounts jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _cust jsonb; _cid uuid; _order record; _existing uuid; _new uuid; _l jsonb;
BEGIN
  _cust := public.customer_from_token(_token, _store_id);
  IF _cust IS NULL OR (_cust->>'id') IS NULL THEN
    RETURN jsonb_build_object('error', 'Please sign in to request a return');
  END IF;
  _cid := (_cust->>'id')::uuid;

  SELECT * INTO _order FROM public.orders
   WHERE id = _order_id AND store_id = _store_id AND customer_id = _cid;
  IF _order IS NULL THEN RETURN jsonb_build_object('error', 'Order not found'); END IF;
  IF _order.status = 'cancelled' THEN RETURN jsonb_build_object('error', 'Cancelled orders are not eligible'); END IF;

  SELECT id INTO _existing FROM public.returns
   WHERE order_id = _order_id
     AND status NOT IN ('rejected','completed','cancelled','refunded')
   LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'A request is already open for this order');
  END IF;

  INSERT INTO public.returns (
    store_id, order_id, customer_id, customer_name, phone,
    type, request_kind, reason, status, items, images, replacement_note, customer_note,
    replacement_items, items_value, replacement_value, return_shipping_charge,
    replacement_shipping_charge, restocking_fee, refund_amount, extra_payment_due,
    replacement_product_id
  ) VALUES (
    _store_id, _order_id, _cid, _order.customer_name, _order.phone,
    _type::return_type, _kind, NULLIF(_reason,''), 'requested',
    COALESCE(_lines, '[]'::jsonb), COALESCE(_images, '{}'::text[]),
    NULLIF(_amounts->>'replacement_note',''), NULLIF(_note,''),
    COALESCE(_replacement_items, '[]'::jsonb),
    COALESCE((_amounts->>'items_value')::numeric, 0),
    COALESCE((_amounts->>'replacement_value')::numeric, 0),
    COALESCE((_amounts->>'return_shipping_charge')::numeric, 0),
    COALESCE((_amounts->>'replacement_shipping_charge')::numeric, 0),
    COALESCE((_amounts->>'restocking_fee')::numeric, 0),
    COALESCE((_amounts->>'refund_amount')::numeric, 0),
    COALESCE((_amounts->>'extra_payment_due')::numeric, 0),
    NULLIF(_replacement_items->0->>'product_id','')::uuid
  ) RETURNING id INTO _new;

  FOR _l IN SELECT * FROM jsonb_array_elements(COALESCE(_lines, '[]'::jsonb)) LOOP
    INSERT INTO public.return_items (
      return_id, store_id, order_item_id, product_id, name, variant, qty, unit_price, image_url
    ) VALUES (
      _new, _store_id,
      NULLIF(_l->>'order_item_id','')::uuid,
      NULLIF(_l->>'product_id','')::uuid,
      COALESCE(_l->>'name','Item'),
      NULLIF(_l->>'variant',''),
      GREATEST(COALESCE((_l->>'qty')::int, 1), 1),
      COALESCE((_l->>'price')::numeric, 0),
      NULLIF(_l->>'image_url','')
    );
  END LOOP;

  INSERT INTO public.return_timeline(return_id, store_id, status, note, actor)
  VALUES (_new, _store_id, 'requested', NULLIF(_reason,''), 'customer');

  RETURN jsonb_build_object('id', _new);
END $$;
REVOKE ALL ON FUNCTION public.customer_create_return_v2(text, uuid, uuid, text, text, text, text, jsonb, jsonb, text[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_create_return_v2(text, uuid, uuid, text, text, text, text, jsonb, jsonb, text[], jsonb) TO service_role;