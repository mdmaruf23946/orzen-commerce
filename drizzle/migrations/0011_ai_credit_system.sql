CREATE TABLE public.ai_credit_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  tokens_per_credit integer NOT NULL DEFAULT 1000,
  enforce_limits boolean NOT NULL DEFAULT false,
  visible_to_merchants boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ai_credit_settings (id) VALUES (true);
GRANT SELECT, INSERT, UPDATE ON public.ai_credit_settings TO authenticated;
GRANT ALL ON public.ai_credit_settings TO service_role;
ALTER TABLE public.ai_credit_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manage credit settings" ON public.ai_credit_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.ai_credit_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  price_bdt numeric NOT NULL DEFAULT 0 CHECK (price_bdt >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_credit_bundles TO authenticated;
GRANT ALL ON public.ai_credit_bundles TO service_role;
ALTER TABLE public.ai_credit_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manage credit bundles" ON public.ai_credit_bundles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

ALTER TABLE public.subscription_packages ADD COLUMN IF NOT EXISTS ai_credits_included integer NOT NULL DEFAULT 0;

CREATE TABLE public.store_ai_credits (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  token_carry integer NOT NULL DEFAULT 0,
  lifetime_used numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.store_ai_credits TO authenticated;
GRANT ALL ON public.store_ai_credits TO service_role;
ALTER TABLE public.store_ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manage store credits" ON public.store_ai_credits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.ai_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  delta numeric NOT NULL,
  kind text NOT NULL,
  channel text,
  tokens integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_credit_ledger_store_idx ON public.ai_credit_ledger(store_id, created_at DESC);
GRANT SELECT, INSERT ON public.ai_credit_ledger TO authenticated;
GRANT ALL ON public.ai_credit_ledger TO service_role;
ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read ledger" ON public.ai_credit_ledger FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE OR REPLACE FUNCTION public.consume_ai_credits(_store uuid, _tokens integer, _channel text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tpc integer; total integer; whole integer; bal numeric;
BEGIN
  IF _store IS NULL OR coalesce(_tokens,0) <= 0 THEN RETURN NULL; END IF;
  SELECT tokens_per_credit INTO tpc FROM ai_credit_settings WHERE id;
  tpc := greatest(coalesce(tpc,1000),1);
  INSERT INTO store_ai_credits(store_id) VALUES (_store) ON CONFLICT DO NOTHING;
  SELECT token_carry + _tokens INTO total FROM store_ai_credits WHERE store_id=_store FOR UPDATE;
  whole := total / tpc;
  UPDATE store_ai_credits SET token_carry = total - whole*tpc, balance = balance - whole,
    lifetime_used = lifetime_used + whole, updated_at = now()
    WHERE store_id=_store RETURNING balance INTO bal;
  IF whole > 0 THEN
    INSERT INTO ai_credit_ledger(store_id,delta,kind,channel,tokens) VALUES (_store,-whole,'usage',_channel,_tokens);
  END IF;
  RETURN bal;
END $$;
REVOKE ALL ON FUNCTION public.consume_ai_credits(uuid,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(uuid,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.grant_ai_credits(_store uuid, _credits numeric, _kind text, _note text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal numeric;
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR auth.role()='service_role') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO store_ai_credits(store_id) VALUES (_store) ON CONFLICT DO NOTHING;
  UPDATE store_ai_credits SET balance = balance + _credits, updated_at=now() WHERE store_id=_store RETURNING balance INTO bal;
  INSERT INTO ai_credit_ledger(store_id,delta,kind,note) VALUES (_store,_credits,_kind,_note);
  RETURN bal;
END $$;
REVOKE ALL ON FUNCTION public.grant_ai_credits(uuid,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_ai_credits(uuid,numeric,text,text) TO authenticated, service_role;