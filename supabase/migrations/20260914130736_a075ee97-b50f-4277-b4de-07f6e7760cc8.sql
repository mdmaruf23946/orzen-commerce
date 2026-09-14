-- 1. Agent state
CREATE TABLE public.store_ai_agent_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'needs_setup',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, agent_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ai_agent_state TO authenticated;
GRANT ALL ON public.store_ai_agent_state TO service_role;
ALTER TABLE public.store_ai_agent_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store members manage agent state" ON public.store_ai_agent_state
  FOR ALL TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));

-- 2. Merchant identities
CREATE TABLE public.store_ai_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel text NOT NULL,
  identifier text NOT NULL,
  label text,
  verified boolean NOT NULL DEFAULT false,
  verify_code text,
  verify_expires_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, channel, identifier)
);
CREATE INDEX store_ai_identities_lookup ON public.store_ai_identities (channel, identifier) WHERE verified;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ai_identities TO authenticated;
GRANT ALL ON public.store_ai_identities TO service_role;
ALTER TABLE public.store_ai_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store members manage identities" ON public.store_ai_identities
  FOR ALL TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));

-- 3. Permissions
CREATE TABLE public.store_ai_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  level text NOT NULL DEFAULT 'approval',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, action_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ai_permissions TO authenticated;
GRANT ALL ON public.store_ai_permissions TO service_role;
ALTER TABLE public.store_ai_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store members manage ai permissions" ON public.store_ai_permissions
  FOR ALL TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));

-- 4. Pending actions
CREATE TABLE public.store_ai_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  action_key text NOT NULL,
  title text NOT NULL,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  requested_via text NOT NULL DEFAULT 'panel',
  requested_by text,
  result jsonb,
  error text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  decided_at timestamptz,
  decided_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_ai_pending_actions_store_status ON public.store_ai_pending_actions (store_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ai_pending_actions TO authenticated;
GRANT ALL ON public.store_ai_pending_actions TO service_role;
ALTER TABLE public.store_ai_pending_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store members manage pending actions" ON public.store_ai_pending_actions
  FOR ALL TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));

-- 5. Activity logs
CREATE TABLE public.store_ai_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  thread_id uuid,
  agent_key text,
  action_key text,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_ai_activity_logs_store_time ON public.store_ai_activity_logs (store_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.store_ai_activity_logs TO authenticated;
GRANT ALL ON public.store_ai_activity_logs TO service_role;
ALTER TABLE public.store_ai_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store members read activity" ON public.store_ai_activity_logs
  FOR ALL TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));

-- 6. Notification rules
CREATE TABLE public.store_ai_notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  channels text[] NOT NULL DEFAULT ARRAY['panel']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, event_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ai_notification_rules TO authenticated;
GRANT ALL ON public.store_ai_notification_rules TO service_role;
ALTER TABLE public.store_ai_notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store members manage notification rules" ON public.store_ai_notification_rules
  FOR ALL TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));

-- 7. Threads
CREATE TABLE public.store_ai_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'panel',
  identity_ref text,
  title text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_ai_threads_lookup ON public.store_ai_threads (store_id, channel, identity_ref);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ai_threads TO authenticated;
GRANT ALL ON public.store_ai_threads TO service_role;
ALTER TABLE public.store_ai_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store members manage ai threads" ON public.store_ai_threads
  FOR ALL TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));

-- 8. Thread messages
CREATE TABLE public.store_ai_thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.store_ai_threads(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_ai_thread_messages_thread ON public.store_ai_thread_messages (thread_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.store_ai_thread_messages TO authenticated;
GRANT ALL ON public.store_ai_thread_messages TO service_role;
ALTER TABLE public.store_ai_thread_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store members manage ai thread messages" ON public.store_ai_thread_messages
  FOR ALL TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));

-- updated_at triggers
CREATE TRIGGER trg_store_ai_agent_state_touch BEFORE UPDATE ON public.store_ai_agent_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_store_ai_identities_touch BEFORE UPDATE ON public.store_ai_identities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_store_ai_permissions_touch BEFORE UPDATE ON public.store_ai_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_store_ai_pending_actions_touch BEFORE UPDATE ON public.store_ai_pending_actions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_store_ai_notification_rules_touch BEFORE UPDATE ON public.store_ai_notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();