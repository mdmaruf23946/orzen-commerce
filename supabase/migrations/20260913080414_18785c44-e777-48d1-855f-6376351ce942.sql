
-- AI Admin Control (Winner Admin) ------------------------------------------

CREATE TABLE public.ai_admin_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  status text NOT NULL DEFAULT 'disconnected',
  phone_number_id text,
  waba_id text,
  display_number text,
  verify_token text,
  credentials_enc text,
  credentials_hint text,
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_connections TO authenticated;
GRANT ALL ON public.ai_admin_connections TO service_role;
ALTER TABLE public.ai_admin_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages ai admin connection" ON public.ai_admin_connections
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.ai_admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  agent_enabled boolean NOT NULL DEFAULT false,
  test_mode boolean NOT NULL DEFAULT true,
  reply_language text NOT NULL DEFAULT 'auto',
  model text NOT NULL DEFAULT 'google/gemini-3.8-flash',
  admin_numbers text[] NOT NULL DEFAULT '{}',
  rate_limit_per_minute integer NOT NULL DEFAULT 20,
  confirm_medium_risk boolean NOT NULL DEFAULT true,
  confirm_high_risk boolean NOT NULL DEFAULT true,
  daily_digest_enabled boolean NOT NULL DEFAULT false,
  daily_digest_hour integer NOT NULL DEFAULT 9,
  pending_alert_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_settings TO authenticated;
GRANT ALL ON public.ai_admin_settings TO service_role;
ALTER TABLE public.ai_admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages ai admin settings" ON public.ai_admin_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.ai_admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL UNIQUE,
  group_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  risk text NOT NULL DEFAULT 'low',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_permissions TO authenticated;
GRANT ALL ON public.ai_admin_permissions TO service_role;
ALTER TABLE public.ai_admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages ai admin permissions" ON public.ai_admin_permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.ai_admin_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL UNIQUE,
  display_name text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_threads TO authenticated;
GRANT ALL ON public.ai_admin_threads TO service_role;
ALTER TABLE public.ai_admin_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads ai admin threads" ON public.ai_admin_threads
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.ai_admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.ai_admin_threads(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_admin_messages_thread_idx ON public.ai_admin_messages(thread_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_messages TO authenticated;
GRANT ALL ON public.ai_admin_messages TO service_role;
ALTER TABLE public.ai_admin_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads ai admin messages" ON public.ai_admin_messages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.ai_admin_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.ai_admin_threads(id) ON DELETE CASCADE,
  wa_id text,
  action_key text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL,
  risk text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_admin_pending_status_idx ON public.ai_admin_pending_actions(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_pending_actions TO authenticated;
GRANT ALL ON public.ai_admin_pending_actions TO service_role;
ALTER TABLE public.ai_admin_pending_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages ai admin pending" ON public.ai_admin_pending_actions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.ai_admin_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL,
  risk text NOT NULL DEFAULT 'low',
  command text,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL DEFAULT 'success',
  result_detail text,
  target_label text,
  channel text NOT NULL DEFAULT 'whatsapp',
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_admin_action_logs_created_idx ON public.ai_admin_action_logs(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_action_logs TO authenticated;
GRANT ALL ON public.ai_admin_action_logs TO service_role;
ALTER TABLE public.ai_admin_action_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads ai admin logs" ON public.ai_admin_action_logs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.ai_admin_notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  template text NOT NULL DEFAULT '',
  recipient text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_notification_rules TO authenticated;
GRANT ALL ON public.ai_admin_notification_rules TO service_role;
ALTER TABLE public.ai_admin_notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages ai admin rules" ON public.ai_admin_notification_rules
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.ai_admin_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text UNIQUE,
  wa_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_admin_webhook_created_idx ON public.ai_admin_webhook_events(created_at DESC);
GRANT SELECT ON public.ai_admin_webhook_events TO authenticated;
GRANT ALL ON public.ai_admin_webhook_events TO service_role;
ALTER TABLE public.ai_admin_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads ai admin webhook events" ON public.ai_admin_webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'owner'));

CREATE TRIGGER ai_admin_connections_touch BEFORE UPDATE ON public.ai_admin_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ai_admin_settings_touch BEFORE UPDATE ON public.ai_admin_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ai_admin_permissions_touch BEFORE UPDATE ON public.ai_admin_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ai_admin_threads_touch BEFORE UPDATE ON public.ai_admin_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ai_admin_pending_touch BEFORE UPDATE ON public.ai_admin_pending_actions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ai_admin_rules_touch BEFORE UPDATE ON public.ai_admin_notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.ai_admin_connections (singleton) VALUES (true);
INSERT INTO public.ai_admin_settings (singleton) VALUES (true);

INSERT INTO public.ai_admin_notification_rules (event_key, enabled, template) VALUES
  ('new_user', true, E'🔔 New User Registered\n\nName: {{name}}\nEmail: {{email}}\nPlan: {{plan}}\nTime: {{time}}'),
  ('new_subscription', true, E'💳 New Subscription\n\nUser: {{name}}\nPlan: {{plan}}\nAmount: {{amount}}\nTransaction ID: {{txn}}\nStatus: {{status}}\n\nApprove or Reject?'),
  ('payment', true, E'💰 Payment Received\n\nUser: {{name}}\nAmount: {{amount}}\nMethod: {{method}}\nStatus: {{status}}'),
  ('new_order', true, E'🛒 New Order\n\nStore: {{store}}\nOrder: {{invoice}}\nAmount: {{amount}}\nCustomer: {{name}}'),
  ('failed_payment', true, E'⚠️ Failed Payment\n\nUser: {{name}}\nAmount: {{amount}}\nReason: {{reason}}'),
  ('pending_subscription', true, E'⏳ Pending Subscription Alert\n\n{{count}} subscription(s) awaiting approval.'),
  ('system_alert', true, E'🚨 System Alert\n\n{{message}}');
