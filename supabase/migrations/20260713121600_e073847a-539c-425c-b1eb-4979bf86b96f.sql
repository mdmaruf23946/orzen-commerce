
CREATE POLICY "store owner inserts payments"
  ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = payments.store_id
        AND s.owner_user_id = auth.uid()
    )
  );
