-- Payment request fields
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_note text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Prevent duplicate transaction IDs per method (excluding rejected ones)
CREATE UNIQUE INDEX IF NOT EXISTS payments_method_txn_unique
  ON public.payments (method, txn_id)
  WHERE txn_id IS NOT NULL AND status <> 'rejected';

-- Email log for retryable transactional emails
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  template text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  related_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads email logs" ON public.email_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "owner manages email logs" ON public.email_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE INDEX IF NOT EXISTS email_logs_status_created_idx
  ON public.email_logs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_related_payment_idx
  ON public.email_logs (related_payment_id);

CREATE TRIGGER email_logs_touch_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();