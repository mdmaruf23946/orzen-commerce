
CREATE TABLE public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  source text NOT NULL DEFAULT 'live' CHECK (source IN ('live','test')),
  signature_valid boolean,
  verified_status text,
  provider_ref text,
  method text,
  amount numeric,
  currency text,
  payload_summary jsonb,
  headers jsonb,
  status_code int,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_webhook_events_store_provider_idx
  ON public.payment_webhook_events (store_id, provider_id, received_at DESC);

GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can view their webhook events"
ON public.payment_webhook_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = payment_webhook_events.store_id
      AND s.owner_user_id = auth.uid()
  )
);
