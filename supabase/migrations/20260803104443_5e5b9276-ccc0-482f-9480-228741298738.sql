
-- ============ settings ============
CREATE TABLE public.store_subscription_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  auto_renew_default boolean NOT NULL DEFAULT true,
  default_billing_cycle text NOT NULL DEFAULT 'monthly',
  allow_free_trial boolean NOT NULL DEFAULT false,
  trial_days integer NOT NULL DEFAULT 0,
  grace_period_days integer NOT NULL DEFAULT 3,
  renewal_reminder_days integer NOT NULL DEFAULT 7,
  failed_payment_retry integer NOT NULL DEFAULT 3,
  cancellation_policy text,
  refund_policy text,
  subscription_terms text,
  setup_fee numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  invoice_prefix text NOT NULL DEFAULT 'SUB',
  invoice_template_id uuid,
  success_redirect_url text,
  payment_methods text[] NOT NULL DEFAULT ARRAY[]::text[],
  cod_enabled boolean NOT NULL DEFAULT false,
  notify_email boolean NOT NULL DEFAULT true,
  notify_sms boolean NOT NULL DEFAULT false,
  notify_whatsapp boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_subscription_settings TO authenticated;
GRANT ALL ON public.store_subscription_settings TO service_role;
ALTER TABLE public.store_subscription_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages subscription settings" ON public.store_subscription_settings
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_sub_settings_touch BEFORE UPDATE ON public.store_subscription_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ subscriptions ============
CREATE TABLE public.store_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.store_customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  subscription_no text NOT NULL,
  plan_name text NOT NULL,
  plan_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  custom_cycle_days integer,
  status text NOT NULL DEFAULT 'pending',
  price numeric NOT NULL DEFAULT 0,
  renewal_price numeric NOT NULL DEFAULT 0,
  setup_fee numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BDT',
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_country text,
  customer_company text,
  customer_vat text,
  customer_notes text,
  payment_method text,
  started_at timestamptz,
  activated_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_billing_date timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  auto_renew boolean NOT NULL DEFAULT true,
  reminders_opt_in boolean NOT NULL DEFAULT true,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  user_limit integer,
  device_limit integer,
  license_qty integer,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, subscription_no)
);
CREATE INDEX idx_store_subs_store ON public.store_subscriptions(store_id, status);
CREATE INDEX idx_store_subs_customer ON public.store_subscriptions(customer_id);
CREATE INDEX idx_store_subs_next_billing ON public.store_subscriptions(next_billing_date) WHERE status IN ('active','trialing','past_due');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_subscriptions TO authenticated;
GRANT ALL ON public.store_subscriptions TO service_role;
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages store subscriptions" ON public.store_subscriptions
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_store_subs_touch BEFORE UPDATE ON public.store_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ invoices ============
CREATE TABLE public.store_subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.store_subscriptions(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  invoice_no text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  plan_amount numeric NOT NULL DEFAULT 0,
  setup_fee numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BDT',
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz,
  paid_at timestamptz,
  payment_method text,
  txn_id text,
  pay_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  attempts integer NOT NULL DEFAULT 0,
  is_renewal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sub_invoices_sub ON public.store_subscription_invoices(subscription_id, created_at DESC);
CREATE UNIQUE INDEX idx_sub_invoices_token ON public.store_subscription_invoices(pay_token);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_subscription_invoices TO authenticated;
GRANT ALL ON public.store_subscription_invoices TO service_role;
ALTER TABLE public.store_subscription_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages subscription invoices" ON public.store_subscription_invoices
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_sub_invoices_touch BEFORE UPDATE ON public.store_subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ events ============
CREATE TABLE public.store_subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.store_subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sub_events_sub ON public.store_subscription_events(subscription_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_subscription_events TO authenticated;
GRANT ALL ON public.store_subscription_events TO service_role;
ALTER TABLE public.store_subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads subscription events" ON public.store_subscription_events
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- ============ notification outbox ============
CREATE TABLE public.store_subscription_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.store_subscriptions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  recipient text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sub_notifs_pending ON public.store_subscription_notifications(sent_at) WHERE sent_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_subscription_notifications TO authenticated;
GRANT ALL ON public.store_subscription_notifications TO service_role;
ALTER TABLE public.store_subscription_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads subscription notifications" ON public.store_subscription_notifications
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- ============ subscription number generator ============
CREATE OR REPLACE FUNCTION public.next_subscription_no(_store_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _prefix text; _n bigint;
BEGIN
  SELECT COALESCE(invoice_prefix, 'SUB') INTO _prefix
    FROM public.store_subscription_settings WHERE store_id = _store_id;
  IF _prefix IS NULL THEN _prefix := 'SUB'; END IF;
  SELECT COUNT(*) + 1 INTO _n FROM public.store_subscriptions WHERE store_id = _store_id;
  RETURN _prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(_n::text, 5, '0');
END $$;
REVOKE EXECUTE ON FUNCTION public.next_subscription_no(uuid) FROM anon, authenticated;

-- ============ customer-facing reads (token validated) ============
CREATE OR REPLACE FUNCTION public.get_customer_subscriptions(_token text, _store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _c jsonb; _cid uuid;
BEGIN
  _c := public.customer_from_token(_token, _store_id);
  IF _c IS NULL THEN RETURN '[]'::jsonb; END IF;
  _cid := (_c->>'id')::uuid;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'subscription_no', s.subscription_no, 'plan_name', s.plan_name,
      'plan_snapshot', s.plan_snapshot, 'billing_cycle', s.billing_cycle, 'status', s.status,
      'price', s.price, 'renewal_price', s.renewal_price, 'currency', s.currency,
      'started_at', s.started_at, 'activated_at', s.activated_at,
      'current_period_end', s.current_period_end, 'next_billing_date', s.next_billing_date,
      'trial_ends_at', s.trial_ends_at, 'auto_renew', s.auto_renew,
      'reminders_opt_in', s.reminders_opt_in, 'cancel_at_period_end', s.cancel_at_period_end,
      'payment_method', s.payment_method, 'product_id', s.product_id, 'order_id', s.order_id,
      'user_limit', s.user_limit, 'device_limit', s.device_limit, 'license_qty', s.license_qty,
      'invoices', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'invoice_no', i.invoice_no, 'total', i.total, 'status', i.status,
          'due_at', i.due_at, 'paid_at', i.paid_at, 'created_at', i.created_at,
          'period_start', i.period_start, 'period_end', i.period_end,
          'payment_method', i.payment_method, 'pay_token', i.pay_token, 'order_id', i.order_id
        ) ORDER BY i.created_at DESC)
        FROM public.store_subscription_invoices i WHERE i.subscription_id = s.id), '[]'::jsonb)
    ) ORDER BY s.created_at DESC)
    FROM public.store_subscriptions s
    WHERE s.customer_id = _cid AND s.store_id = _store_id
  ), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.get_public_subscription_order(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _s record;
BEGIN
  SELECT * INTO _s FROM public.store_subscriptions WHERE order_id = _order_id LIMIT 1;
  IF _s.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', _s.id, 'subscription_no', _s.subscription_no, 'plan_name', _s.plan_name,
    'plan_snapshot', _s.plan_snapshot, 'billing_cycle', _s.billing_cycle, 'status', _s.status,
    'price', _s.price, 'renewal_price', _s.renewal_price, 'currency', _s.currency,
    'started_at', _s.started_at, 'activated_at', _s.activated_at,
    'current_period_end', _s.current_period_end, 'next_billing_date', _s.next_billing_date,
    'trial_ends_at', _s.trial_ends_at, 'auto_renew', _s.auto_renew,
    'payment_method', _s.payment_method,
    'user_limit', _s.user_limit, 'device_limit', _s.device_limit, 'license_qty', _s.license_qty,
    'invoices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'invoice_no', i.invoice_no, 'total', i.total, 'status', i.status,
        'paid_at', i.paid_at, 'created_at', i.created_at
      ) ORDER BY i.created_at DESC)
      FROM public.store_subscription_invoices i WHERE i.subscription_id = _s.id), '[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_store_subscription_public_settings(_store_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'auto_renew_default', s.auto_renew_default,
    'default_billing_cycle', s.default_billing_cycle,
    'allow_free_trial', s.allow_free_trial,
    'trial_days', s.trial_days,
    'grace_period_days', s.grace_period_days,
    'cancellation_policy', s.cancellation_policy,
    'refund_policy', s.refund_policy,
    'subscription_terms', s.subscription_terms,
    'setup_fee', s.setup_fee,
    'tax_percent', s.tax_percent,
    'payment_methods', s.payment_methods,
    'cod_enabled', s.cod_enabled,
    'success_redirect_url', s.success_redirect_url
  )
  FROM public.store_subscription_settings s WHERE s.store_id = _store_id;
$$;
