-- Wallet tables
CREATE TABLE public.merchant_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency TEXT NOT NULL DEFAULT 'BDT',
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  auto_renew_cycle TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.merchant_wallets TO authenticated;
GRANT ALL ON public.merchant_wallets TO service_role;
ALTER TABLE public.merchant_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants read own wallet" ON public.merchant_wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners read all wallets" ON public.merchant_wallets
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.merchant_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('topup','plan_payment','auto_renewal','refund','adjustment')),
  amount NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  invoice_id UUID REFERENCES public.subscription_invoices(id) ON DELETE SET NULL,
  reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants read own wallet transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners read all wallet transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE INDEX idx_wallet_tx_wallet ON public.wallet_transactions(wallet_id, created_at DESC);
CREATE UNIQUE INDEX idx_wallet_tx_topup_invoice
  ON public.wallet_transactions(invoice_id) WHERE invoice_id IS NOT NULL AND type = 'topup';

CREATE TRIGGER trg_merchant_wallets_updated_at
  BEFORE UPDATE ON public.merchant_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice purpose
ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'plan';

-- Ensure a wallet row exists
CREATE OR REPLACE FUNCTION public.wallet_ensure(_user_id UUID, _store_id UUID DEFAULT NULL)
RETURNS public.merchant_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE w public.merchant_wallets;
BEGIN
  SELECT * INTO w FROM public.merchant_wallets WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.merchant_wallets(user_id, store_id) VALUES (_user_id, _store_id)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
    RETURNING * INTO w;
  ELSIF _store_id IS NOT NULL AND w.store_id IS DISTINCT FROM _store_id THEN
    UPDATE public.merchant_wallets SET store_id = _store_id WHERE id = w.id RETURNING * INTO w;
  END IF;
  RETURN w;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_ensure(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_ensure(UUID, UUID) TO service_role;

-- Atomic credit (idempotent per top-up invoice)
CREATE OR REPLACE FUNCTION public.wallet_credit(
  _user_id UUID, _amount NUMERIC, _type TEXT, _invoice_id UUID DEFAULT NULL,
  _reference TEXT DEFAULT NULL, _note TEXT DEFAULT NULL, _store_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE w public.merchant_wallets; newbal NUMERIC; existing UUID;
BEGIN
  IF _amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid amount'); END IF;
  w := public.wallet_ensure(_user_id, _store_id);

  IF _invoice_id IS NOT NULL AND _type = 'topup' THEN
    SELECT id INTO existing FROM public.wallet_transactions
      WHERE invoice_id = _invoice_id AND type = 'topup';
    IF existing IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'already', true, 'balance', w.balance);
    END IF;
  END IF;

  UPDATE public.merchant_wallets
    SET balance = balance + _amount
    WHERE id = w.id
    RETURNING balance INTO newbal;

  INSERT INTO public.wallet_transactions(wallet_id, user_id, type, amount, balance_after, invoice_id, reference, note)
  VALUES (w.id, _user_id, _type, _amount, newbal, _invoice_id, _reference, _note);

  RETURN jsonb_build_object('ok', true, 'balance', newbal);
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_credit(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_credit(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT, UUID) TO service_role;

-- Atomic debit
CREATE OR REPLACE FUNCTION public.wallet_debit(
  _user_id UUID, _amount NUMERIC, _type TEXT, _invoice_id UUID DEFAULT NULL,
  _reference TEXT DEFAULT NULL, _note TEXT DEFAULT NULL, _store_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE w public.merchant_wallets; newbal NUMERIC;
BEGIN
  IF _amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid amount'); END IF;
  w := public.wallet_ensure(_user_id, _store_id);

  UPDATE public.merchant_wallets
    SET balance = balance - _amount
    WHERE id = w.id AND balance >= _amount
    RETURNING balance INTO newbal;

  IF newbal IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Insufficient balance', 'balance', w.balance);
  END IF;

  INSERT INTO public.wallet_transactions(wallet_id, user_id, type, amount, balance_after, invoice_id, reference, note)
  VALUES (w.id, _user_id, _type, -_amount, newbal, _invoice_id, _reference, _note);

  RETURN jsonb_build_object('ok', true, 'balance', newbal);
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_debit(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_debit(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT, UUID) TO service_role;