
-- Fix search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Revoke EXECUTE from public/anon/authenticated on security definer + helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Tighten orders/order_items insert: only for active stores
DROP POLICY IF EXISTS "orders public insert" ON public.orders;
CREATE POLICY "orders insert active store" ON public.orders FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'active'));

DROP POLICY IF EXISTS "order items public insert" ON public.order_items;
CREATE POLICY "order items insert for valid order" ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o JOIN public.stores s ON s.id = o.store_id
                      WHERE o.id = order_id AND s.status = 'active'));
