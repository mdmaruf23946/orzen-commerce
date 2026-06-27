
-- AI Sales Agent system
CREATE TABLE IF NOT EXISTS public.ai_global_settings (
  id INT PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  default_model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  provider_api_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.ai_global_settings TO authenticated;
GRANT ALL ON public.ai_global_settings TO service_role;
ALTER TABLE public.ai_global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can read ai settings" ON public.ai_global_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner can upsert ai settings" ON public.ai_global_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
INSERT INTO public.ai_global_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TRIGGER trg_ai_global_settings_touch BEFORE UPDATE ON public.ai_global_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads all usage" ON public.ai_usage FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Store owner reads own usage" ON public.ai_usage FOR SELECT TO authenticated USING (
  store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = ai_usage.store_id AND s.owner_user_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS ai_usage_store_idx ON public.ai_usage(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.store_ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  agent_name TEXT NOT NULL DEFAULT 'Sales Assistant',
  welcome_message TEXT NOT NULL DEFAULT 'Hi! How can I help you today?',
  language TEXT NOT NULL DEFAULT 'both',
  style TEXT NOT NULL DEFAULT 'friendly',
  use_emoji BOOLEAN NOT NULL DEFAULT true,
  human_like BOOLEAN NOT NULL DEFAULT true,
  knowledge JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ai_agents TO authenticated;
GRANT SELECT ON public.store_ai_agents TO anon;
GRANT ALL ON public.store_ai_agents TO service_role;
ALTER TABLE public.store_ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read enabled agents" ON public.store_ai_agents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Store owner manages agent" ON public.store_ai_agents FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_ai_agents.store_id AND s.owner_user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_ai_agents.store_id AND s.owner_user_id = auth.uid())
);
CREATE TRIGGER trg_store_ai_agents_touch BEFORE UPDATE ON public.store_ai_agents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'web',
  external_id TEXT,
  customer_name TEXT,
  phone TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owner reads conversations" ON public.ai_conversations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = ai_conversations.store_id AND s.owner_user_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS ai_conversations_store_idx ON public.ai_conversations(store_id, created_at DESC);
CREATE TRIGGER trg_ai_conversations_touch BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owner reads messages" ON public.ai_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ai_conversations c JOIN public.stores s ON s.id = c.store_id WHERE c.id = ai_messages.conversation_id AND s.owner_user_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS ai_messages_conv_idx ON public.ai_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.messenger_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  page_id TEXT,
  page_access_token TEXT,
  verify_token TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messenger_integrations TO authenticated;
GRANT ALL ON public.messenger_integrations TO service_role;
ALTER TABLE public.messenger_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owner manages messenger" ON public.messenger_integrations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = messenger_integrations.store_id AND s.owner_user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = messenger_integrations.store_id AND s.owner_user_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS messenger_page_idx ON public.messenger_integrations(page_id);
CREATE TRIGGER trg_messenger_integrations_touch BEFORE UPDATE ON public.messenger_integrations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
