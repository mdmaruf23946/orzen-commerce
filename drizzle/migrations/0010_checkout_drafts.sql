CREATE TABLE IF NOT EXISTS public.checkout_drafts (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL,
  customer_name text,
  phone text,
  email text,
  address text,
  area text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  converted_order_id uuid,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.checkout_drafts TO service_role;
ALTER TABLE public.checkout_drafts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS checkout_drafts_store_idx ON public.checkout_drafts(store_id, updated_at DESC);