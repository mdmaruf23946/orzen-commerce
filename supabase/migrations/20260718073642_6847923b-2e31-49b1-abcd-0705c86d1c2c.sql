
CREATE POLICY "store owner reads orders" ON public.orders
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id AND s.owner_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'owner'::app_role)
);

CREATE POLICY "store owner reads order_items" ON public.order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.id = order_items.order_id
      AND (s.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'::app_role))
  )
);
