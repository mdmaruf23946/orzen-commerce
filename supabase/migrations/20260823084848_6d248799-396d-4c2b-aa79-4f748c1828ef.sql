-- ============ Owner-global config ============
CREATE TABLE public.ai_call_config (
  id text PRIMARY KEY DEFAULT 'global',
  elevenlabs_credentials text,
  elevenlabs_preview text,
  elevenlabs_status text NOT NULL DEFAULT 'not_connected',
  elevenlabs_last_error text,
  twilio_credentials text,
  twilio_preview text,
  twilio_status text NOT NULL DEFAULT 'not_connected',
  twilio_last_error text,
  default_agent_id uuid,
  default_voice_id uuid,
  default_language text NOT NULL DEFAULT 'en',
  default_gender text NOT NULL DEFAULT 'female',
  default_tone_id uuid,
  default_instructions text,
  default_caller_id text,
  calling_region text NOT NULL DEFAULT 'us1',
  behavior jsonb NOT NULL DEFAULT '{"interruptions":true,"barge_in":true,"turn_taking":true,"response_delay_ms":300,"silence_timeout_sec":8,"max_response_chars":600,"conversation_timeout_sec":300}'::jsonb,
  rules jsonb NOT NULL DEFAULT '{"auto_confirm_orders":true,"delay_minutes":5,"retry_count":2,"retry_interval_minutes":30,"max_duration_sec":300,"call_start_hour":9,"call_end_hour":21,"weekend_calling":true,"holiday_calling":false}'::jsonb,
  business jsonb NOT NULL DEFAULT '{"greeting":true,"order_confirmation":true,"product_questions":true,"availability":true,"pricing":true,"delivery_info":true,"cancellation":true,"address_change":true,"callback":true,"human_transfer":true}'::jsonb,
  tools jsonb NOT NULL DEFAULT '{"get_order":true,"confirm_order":true,"cancel_order":true,"update_order":true,"change_address":true,"get_product":true,"check_stock":true,"get_delivery_charge":true,"create_callback":true,"transfer_to_human":true,"create_support_ticket":true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_call_config TO authenticated;
GRANT ALL ON public.ai_call_config TO service_role;
ALTER TABLE public.ai_call_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages ai call config" ON public.ai_call_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

INSERT INTO public.ai_call_config (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- ============ Voice library ============
CREATE TABLE public.ai_call_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  elevenlabs_voice_id text NOT NULL,
  gender text NOT NULL DEFAULT 'female',
  language text NOT NULL DEFAULT 'en',
  accent text,
  tone text,
  description text,
  speed numeric NOT NULL DEFAULT 1.0,
  preview_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_call_voices TO authenticated;
GRANT ALL ON public.ai_call_voices TO service_role;
ALTER TABLE public.ai_call_voices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages voices" ON public.ai_call_voices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "store admins read active voices" ON public.ai_call_voices
  FOR SELECT TO authenticated
  USING (is_active = true);

-- ============ Voice tones ============
CREATE TABLE public.ai_call_tones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  instructions text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_call_tones TO authenticated;
GRANT ALL ON public.ai_call_tones TO service_role;
ALTER TABLE public.ai_call_tones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages tones" ON public.ai_call_tones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Tone instructions must stay hidden from store admins; they read tones through
-- a security-definer function that projects only safe columns.
CREATE OR REPLACE FUNCTION public.list_ai_call_tones_public()
RETURNS TABLE(id uuid, name text, description text, sort_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id, name, description, sort_order
  FROM public.ai_call_tones
  WHERE is_active = true
  ORDER BY sort_order, name;
$$;
REVOKE ALL ON FUNCTION public.list_ai_call_tones_public() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_ai_call_tones_public() TO authenticated, service_role;

-- ============ AI agents (template + per store) ============
CREATE TABLE public.ai_call_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  is_template boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  elevenlabs_agent_id text,
  voice_id uuid REFERENCES public.ai_call_voices(id) ON DELETE SET NULL,
  tone_id uuid REFERENCES public.ai_call_tones(id) ON DELETE SET NULL,
  gender text NOT NULL DEFAULT 'female',
  language text NOT NULL DEFAULT 'en',
  personality text,
  instructions text,
  knowledge text,
  tools jsonb NOT NULL DEFAULT '{}'::jsonb,
  inbound_enabled boolean NOT NULL DEFAULT true,
  outbound_enabled boolean NOT NULL DEFAULT true,
  tool_secret text,
  status text NOT NULL DEFAULT 'active',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_call_agents_one_template ON public.ai_call_agents (is_template) WHERE is_template = true;
CREATE INDEX ai_call_agents_store_idx ON public.ai_call_agents (store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_call_agents TO authenticated;
GRANT ALL ON public.ai_call_agents TO service_role;
ALTER TABLE public.ai_call_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages agents" ON public.ai_call_agents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- ============ Phone numbers ============
CREATE TABLE public.ai_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  country text NOT NULL DEFAULT 'US',
  label text,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.ai_call_agents(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'twilio',
  provider_sid text,
  elevenlabs_phone_id text,
  inbound_enabled boolean NOT NULL DEFAULT true,
  outbound_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'inactive',
  available_to_store boolean NOT NULL DEFAULT false,
  minutes_used numeric NOT NULL DEFAULT 0,
  calls_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_phone_numbers_store_idx ON public.ai_phone_numbers (store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_phone_numbers TO authenticated;
GRANT ALL ON public.ai_phone_numbers TO service_role;
ALTER TABLE public.ai_phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages numbers" ON public.ai_phone_numbers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "store admins read their numbers" ON public.ai_phone_numbers
  FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND public.is_store_owner(store_id));

-- ============ Per-store settings ============
CREATE TABLE public.store_ai_call_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  feature_enabled boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  phone_number_id uuid REFERENCES public.ai_phone_numbers(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.ai_call_agents(id) ON DELETE SET NULL,
  voice_id uuid REFERENCES public.ai_call_voices(id) ON DELETE SET NULL,
  tone_id uuid REFERENCES public.ai_call_tones(id) ON DELETE SET NULL,
  gender text NOT NULL DEFAULT 'female',
  inbound_enabled boolean NOT NULL DEFAULT true,
  outbound_enabled boolean NOT NULL DEFAULT true,
  auto_confirm_orders boolean NOT NULL DEFAULT true,
  activated_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ai_call_settings TO authenticated;
GRANT ALL ON public.store_ai_call_settings TO service_role;
ALTER TABLE public.store_ai_call_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages store ai call settings" ON public.store_ai_call_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "store admins read own ai call settings" ON public.store_ai_call_settings
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

-- ============ AI calls ============
CREATE TABLE public.ai_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id uuid,
  agent_id uuid REFERENCES public.ai_call_agents(id) ON DELETE SET NULL,
  phone_number_id uuid REFERENCES public.ai_phone_numbers(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'outbound',
  customer_name text,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  result text,
  duration_sec integer NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  provider_call_sid text,
  conversation_id text,
  recording_url text,
  summary text,
  attempt integer NOT NULL DEFAULT 1,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_calls_store_idx ON public.ai_calls (store_id, created_at DESC);
CREATE INDEX ai_calls_conversation_idx ON public.ai_calls (conversation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_calls TO authenticated;
GRANT ALL ON public.ai_calls TO service_role;
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads all ai calls" ON public.ai_calls
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "store admins read own ai calls" ON public.ai_calls
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

-- ============ Transcripts ============
CREATE TABLE public.ai_call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.ai_calls(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role text NOT NULL,
  message text NOT NULL,
  seq integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_call_transcripts_call_idx ON public.ai_call_transcripts (call_id, seq);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_call_transcripts TO authenticated;
GRANT ALL ON public.ai_call_transcripts TO service_role;
ALTER TABLE public.ai_call_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads all transcripts" ON public.ai_call_transcripts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "store admins read own transcripts" ON public.ai_call_transcripts
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

-- ============ Outbound queue ============
CREATE TABLE public.ai_call_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  phone text NOT NULL,
  customer_name text,
  purpose text NOT NULL DEFAULT 'order_confirmation',
  run_after timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_call_queue_due_idx ON public.ai_call_queue (status, run_after);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_call_queue TO authenticated;
GRANT ALL ON public.ai_call_queue TO service_role;
ALTER TABLE public.ai_call_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages call queue" ON public.ai_call_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "store admins read own queue" ON public.ai_call_queue
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

-- ============ updated_at triggers ============
CREATE TRIGGER trg_ai_call_config_updated BEFORE UPDATE ON public.ai_call_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_call_voices_updated BEFORE UPDATE ON public.ai_call_voices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_call_tones_updated BEFORE UPDATE ON public.ai_call_tones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_call_agents_updated BEFORE UPDATE ON public.ai_call_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_phone_numbers_updated BEFORE UPDATE ON public.ai_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_store_ai_call_settings_updated BEFORE UPDATE ON public.store_ai_call_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_calls_updated BEFORE UPDATE ON public.ai_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_call_queue_updated BEFORE UPDATE ON public.ai_call_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Seed default tones ============
INSERT INTO public.ai_call_tones (name, description, instructions, sort_order) VALUES
  ('Friendly', 'Warm and approachable', 'Speak in a warm, friendly and upbeat manner. Use simple words and sound genuinely happy to help.', 1),
  ('Professional', 'Clear and business-like', 'Speak clearly and professionally. Be concise, accurate and respectful at all times.', 2),
  ('Polite', 'Extra courteous', 'Be extremely polite and courteous. Use please and thank you naturally and never rush the customer.', 3),
  ('Warm', 'Caring and reassuring', 'Sound caring and reassuring. Acknowledge the customer feelings before giving information.', 4),
  ('Energetic', 'Upbeat and lively', 'Sound energetic and enthusiastic while staying clear and easy to follow.', 5),
  ('Calm', 'Slow and steady', 'Speak calmly and at a measured pace. Keep the customer relaxed, especially when handling problems.', 6);