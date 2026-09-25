CREATE TABLE public.conversational_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('messenger', 'whatsapp')),
  external_customer_id text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 99),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.conversational_checkout_sessions TO service_role;

ALTER TABLE public.conversational_checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX conversational_checkout_sessions_store_idx
  ON public.conversational_checkout_sessions (store_id, created_at DESC);
CREATE INDEX conversational_checkout_sessions_expiry_idx
  ON public.conversational_checkout_sessions (expires_at)
  WHERE used_at IS NULL;

CREATE TRIGGER update_conversational_checkout_sessions_updated_at
BEFORE UPDATE ON public.conversational_checkout_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();