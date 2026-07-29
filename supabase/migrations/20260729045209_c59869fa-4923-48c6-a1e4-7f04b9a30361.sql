ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'online';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_gateway_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_gateway_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_ref text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
CREATE INDEX IF NOT EXISTS orders_payment_ref_idx ON public.orders (payment_ref);