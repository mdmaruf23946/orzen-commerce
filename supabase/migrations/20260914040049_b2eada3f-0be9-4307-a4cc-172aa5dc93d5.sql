CREATE TABLE public.ai_admin_kb_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_kb_entries TO authenticated;
GRANT ALL ON public.ai_admin_kb_entries TO service_role;
ALTER TABLE public.ai_admin_kb_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages knowledge base" ON public.ai_admin_kb_entries
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER trg_ai_admin_kb_entries_updated BEFORE UPDATE ON public.ai_admin_kb_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_admin_customer_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  psid text NOT NULL UNIQUE,
  display_name text,
  status text NOT NULL DEFAULT 'ai',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_customer_threads TO authenticated;
GRANT ALL ON public.ai_admin_customer_threads TO service_role;
ALTER TABLE public.ai_admin_customer_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages customer threads" ON public.ai_admin_customer_threads
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER trg_ai_admin_customer_threads_updated BEFORE UPDATE ON public.ai_admin_customer_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_admin_customer_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.ai_admin_customer_threads(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_admin_customer_messages_thread ON public.ai_admin_customer_messages(thread_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_customer_messages TO authenticated;
GRANT ALL ON public.ai_admin_customer_messages TO service_role;
ALTER TABLE public.ai_admin_customer_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages customer messages" ON public.ai_admin_customer_messages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TABLE public.ai_admin_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.ai_admin_customer_threads(id) ON DELETE SET NULL,
  psid text NOT NULL,
  customer_name text,
  reason text,
  summary text,
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_admin_support_requests_status ON public.ai_admin_support_requests(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_support_requests TO authenticated;
GRANT ALL ON public.ai_admin_support_requests TO service_role;
ALTER TABLE public.ai_admin_support_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages support requests" ON public.ai_admin_support_requests
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER trg_ai_admin_support_requests_updated BEFORE UPDATE ON public.ai_admin_support_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ai_admin_settings
  ADD COLUMN IF NOT EXISTS customer_agent_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_agent_model text;