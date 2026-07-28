
-- 1) Custom gateways
CREATE TABLE public.custom_payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  logo_url text,
  description text,
  website_url text,
  docs_url text,
  support_email text,
  currency text NOT NULL DEFAULT 'BDT',
  currencies text[] NOT NULL DEFAULT ARRAY['BDT']::text[],
  status text NOT NULL DEFAULT 'draft',
  environment text NOT NULL DEFAULT 'sandbox',
  auth_type text NOT NULL DEFAULT 'api_key',
  api_base_url text,
  sandbox_base_url text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials_ciphertext text,
  credentials_preview text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  last_tested_at timestamptz,
  last_test_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_pg_status_chk CHECK (status IN ('draft','testing','connected','active','error','disabled')),
  CONSTRAINT custom_pg_env_chk CHECK (environment IN ('sandbox','production'))
);

CREATE UNIQUE INDEX custom_payment_gateways_store_slug_key
  ON public.custom_payment_gateways(store_id, slug);
CREATE UNIQUE INDEX custom_payment_gateways_one_default
  ON public.custom_payment_gateways(store_id) WHERE is_default;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_payment_gateways TO authenticated;
GRANT ALL ON public.custom_payment_gateways TO service_role;
ALTER TABLE public.custom_payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store owner manages custom gateways"
  ON public.custom_payment_gateways
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE TRIGGER trg_custom_pg_touch
  BEFORE UPDATE ON public.custom_payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 2) Webhook events (idempotency)
CREATE TABLE public.custom_payment_gateway_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  gateway_id uuid NOT NULL REFERENCES public.custom_payment_gateways(id) ON DELETE CASCADE,
  event_id text,
  event_type text,
  provider_ref text,
  normalized_status text,
  payload jsonb,
  headers jsonb,
  signature_valid boolean,
  processing_status text NOT NULL DEFAULT 'received',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX custom_pg_events_idem
  ON public.custom_payment_gateway_events(gateway_id, event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX custom_pg_events_store_created
  ON public.custom_payment_gateway_events(store_id, created_at DESC);

GRANT SELECT ON public.custom_payment_gateway_events TO authenticated;
GRANT ALL ON public.custom_payment_gateway_events TO service_role;
ALTER TABLE public.custom_payment_gateway_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store owner reads own gateway events"
  ON public.custom_payment_gateway_events
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

-- 3) Audit log
CREATE TABLE public.custom_payment_gateway_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  gateway_id uuid REFERENCES public.custom_payment_gateways(id) ON DELETE SET NULL,
  actor_user_id uuid,
  action text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX custom_pg_audit_store_created
  ON public.custom_payment_gateway_audit(store_id, created_at DESC);

GRANT SELECT ON public.custom_payment_gateway_audit TO authenticated;
GRANT ALL ON public.custom_payment_gateway_audit TO service_role;
ALTER TABLE public.custom_payment_gateway_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store owner reads own gateway audit"
  ON public.custom_payment_gateway_audit
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

-- 4) Non-secret accessor RPC (belt-and-braces: RLS already filters, but this
-- guarantees credentials_ciphertext never leaves the server).
CREATE OR REPLACE FUNCTION public.get_custom_gateway_public(_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', g.id, 'store_id', g.store_id,
    'name', g.name, 'slug', g.slug, 'logo_url', g.logo_url,
    'description', g.description, 'website_url', g.website_url,
    'docs_url', g.docs_url, 'support_email', g.support_email,
    'currency', g.currency, 'currencies', g.currencies,
    'status', g.status, 'environment', g.environment,
    'auth_type', g.auth_type, 'api_base_url', g.api_base_url,
    'sandbox_base_url', g.sandbox_base_url, 'config', g.config,
    'credentials_preview', g.credentials_preview,
    'has_credentials', g.credentials_ciphertext IS NOT NULL,
    'is_default', g.is_default, 'is_active', g.is_active,
    'last_tested_at', g.last_tested_at, 'last_test_result', g.last_test_result,
    'created_at', g.created_at, 'updated_at', g.updated_at
  )
  FROM public.custom_payment_gateways g
  WHERE g.id = _id AND public.is_store_owner(g.store_id)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_custom_gateway_public(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_custom_gateway_public(uuid) TO authenticated;
