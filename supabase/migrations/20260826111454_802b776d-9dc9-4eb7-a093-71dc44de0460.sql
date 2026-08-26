CREATE TABLE public.store_customer_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.store_customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_customer_reset_tokens_hash_idx ON public.store_customer_reset_tokens (token_hash);
GRANT ALL ON public.store_customer_reset_tokens TO service_role;
ALTER TABLE public.store_customer_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.store_auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  identifier text NOT NULL,
  ip text,
  ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_auth_attempts_lookup_idx ON public.store_auth_attempts (store_id, identifier, created_at DESC);
GRANT ALL ON public.store_auth_attempts TO service_role;
ALTER TABLE public.store_auth_attempts ENABLE ROW LEVEL SECURITY;