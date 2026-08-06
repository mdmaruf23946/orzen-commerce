ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_amount numeric NOT NULL DEFAULT 0;

UPDATE public.orders
   SET paid_amount = CASE WHEN payment_status = 'paid' THEN COALESCE(subtotal, 0) ELSE 0 END,
       due_amount  = CASE WHEN payment_status = 'paid' THEN 0 ELSE COALESCE(subtotal, 0) END
 WHERE paid_amount = 0 AND due_amount = 0;

CREATE POLICY "Store owners insert customer addresses"
  ON public.store_customer_addresses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Store owners update customer addresses"
  ON public.store_customer_addresses
  FOR UPDATE TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

GRANT INSERT, UPDATE ON public.store_customer_addresses TO authenticated;