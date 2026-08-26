DROP POLICY IF EXISTS "tickets owner all" ON public.support_tickets;

CREATE POLICY "tickets select own" ON public.support_tickets
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR created_by = auth.uid()
  OR is_store_owner(store_id)
);

CREATE POLICY "tickets insert scoped" ON public.support_tickets
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR store_id IS NULL
    OR is_store_owner(store_id)
    OR is_store_employee(store_id)
  )
);

CREATE POLICY "tickets update own" ON public.support_tickets
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR created_by = auth.uid()
  OR is_store_owner(store_id)
)
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  OR created_by = auth.uid()
  OR is_store_owner(store_id)
);

CREATE POLICY "tickets delete own" ON public.support_tickets
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR created_by = auth.uid()
  OR is_store_owner(store_id)
);