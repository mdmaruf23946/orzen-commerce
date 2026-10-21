CREATE TABLE public.manual_call_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'sip',
  wss_url text NOT NULL,
  sip_domain text NOT NULL,
  help_text text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_call_gateways TO authenticated;
GRANT ALL ON public.manual_call_gateways TO service_role;
ALTER TABLE public.manual_call_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read active gateways" ON public.manual_call_gateways FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "Owner manages gateways" ON public.manual_call_gateways FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.manual_call_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  gateway_id uuid REFERENCES public.manual_call_gateways(id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT 'My line',
  caller_number text,
  sip_username text NOT NULL,
  sip_password text NOT NULL,
  extension text,
  is_default boolean NOT NULL DEFAULT false,
  record_calls boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX manual_call_lines_store_idx ON public.manual_call_lines(store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_call_lines TO authenticated;
GRANT ALL ON public.manual_call_lines TO service_role;
ALTER TABLE public.manual_call_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store team manages lines" ON public.manual_call_lines FOR ALL TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));

CREATE TABLE public.manual_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  line_id uuid REFERENCES public.manual_call_lines(id) ON DELETE SET NULL,
  user_id uuid,
  direction text NOT NULL DEFAULT 'outbound',
  phone text NOT NULL,
  customer_name text,
  order_id uuid,
  status text NOT NULL DEFAULT 'dialing',
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_sec integer NOT NULL DEFAULT 0,
  recording_path text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX manual_calls_store_idx ON public.manual_calls(store_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_calls TO authenticated;
GRANT ALL ON public.manual_calls TO service_role;
ALTER TABLE public.manual_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store team manages calls" ON public.manual_calls FOR ALL TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));

CREATE POLICY "Store team uploads manual call recordings" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'voice-audio' AND (storage.foldername(name))[1] = 'manual' AND public.has_store_access(((storage.foldername(name))[2])::uuid));
CREATE POLICY "Store team reads manual call recordings" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'voice-audio' AND (storage.foldername(name))[1] = 'manual' AND public.has_store_access(((storage.foldername(name))[2])::uuid));