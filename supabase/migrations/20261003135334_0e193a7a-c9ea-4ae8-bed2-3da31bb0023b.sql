
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS call_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS connection_id uuid,
  ADD COLUMN IF NOT EXISTS answered_at timestamptz,
  ADD COLUMN IF NOT EXISTS dtmf text,
  ADD COLUMN IF NOT EXISTS recording_ref text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

CREATE TABLE public.voice_provider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL,
  encrypted_token text,
  token_preview text,
  status text NOT NULL DEFAULT 'not_connected',
  account_id text,
  account_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_caller_id text,
  default_extension text,
  webhook_secret_hash text,
  last_error text,
  connected_at timestamptz,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, provider)
);
GRANT SELECT ON public.voice_provider_connections TO authenticated;
GRANT ALL ON public.voice_provider_connections TO service_role;
ALTER TABLE public.voice_provider_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own voice connections" ON public.voice_provider_connections
  FOR SELECT TO authenticated USING (public.is_store_owner(store_id));
REVOKE SELECT (encrypted_token, webhook_secret_hash) ON public.voice_provider_connections FROM authenticated;

CREATE TABLE public.voice_automation_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  auto_call_enabled boolean NOT NULL DEFAULT false,
  call_immediately boolean NOT NULL DEFAULT true,
  delay_minutes integer NOT NULL DEFAULT 0 CHECK (delay_minutes BETWEEN 0 AND 1440),
  retry_count integer NOT NULL DEFAULT 1 CHECK (retry_count BETWEEN 0 AND 3),
  retry_delay_minutes integer NOT NULL DEFAULT 30 CHECK (retry_delay_minutes BETWEEN 1 AND 1440),
  business_hours_only boolean NOT NULL DEFAULT false,
  hours_from text NOT NULL DEFAULT '09:00',
  hours_to text NOT NULL DEFAULT '21:00',
  manual_calling_enabled boolean NOT NULL DEFAULT true,
  representative_transfer boolean NOT NULL DEFAULT true,
  messages jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.voice_automation_settings TO authenticated;
GRANT ALL ON public.voice_automation_settings TO service_role;
ALTER TABLE public.voice_automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages voice automation" ON public.voice_automation_settings
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

CREATE TABLE public.voice_call_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  attempt integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued',
  run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  call_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);
CREATE INDEX voice_call_queue_due ON public.voice_call_queue (status, run_at);
GRANT SELECT ON public.voice_call_queue TO authenticated;
GRANT ALL ON public.voice_call_queue TO service_role;
ALTER TABLE public.voice_call_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads voice queue" ON public.voice_call_queue
  FOR SELECT TO authenticated USING (public.is_store_owner(store_id));

CREATE TABLE public.voice_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  call_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
GRANT SELECT ON public.voice_call_events TO authenticated;
GRANT ALL ON public.voice_call_events TO service_role;
ALTER TABLE public.voice_call_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads voice events" ON public.voice_call_events
  FOR SELECT TO authenticated USING (public.is_store_owner(store_id));

CREATE TABLE public.voice_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX voice_audit_store ON public.voice_audit_log (store_id, created_at DESC);
GRANT SELECT ON public.voice_audit_log TO authenticated;
GRANT ALL ON public.voice_audit_log TO service_role;
ALTER TABLE public.voice_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads voice audit" ON public.voice_audit_log
  FOR SELECT TO authenticated USING (public.is_store_owner(store_id));

CREATE TRIGGER t_vpc_upd BEFORE UPDATE ON public.voice_provider_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_vas_upd BEFORE UPDATE ON public.voice_automation_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_vcq_upd BEFORE UPDATE ON public.voice_call_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
