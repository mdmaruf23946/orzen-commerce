CREATE TABLE IF NOT EXISTS public.store_customer_credentials (
  customer_id uuid PRIMARY KEY REFERENCES public.store_customers(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.store_customer_credentials TO service_role;
ALTER TABLE public.store_customer_credentials ENABLE ROW LEVEL SECURITY;

INSERT INTO public.store_customer_credentials (customer_id, password_hash)
SELECT id, password_hash FROM public.store_customers
WHERE password_hash IS NOT NULL AND password_hash <> ''
ON CONFLICT (customer_id) DO NOTHING;

ALTER TABLE public.store_customers DROP COLUMN IF EXISTS password_hash;

ALTER PUBLICATION supabase_realtime DROP TABLE public.store_customers;

CREATE POLICY "owner inserts redemptions" ON public.coupon_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_store_owner(store_id));
GRANT INSERT ON public.coupon_redemptions TO authenticated;

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;