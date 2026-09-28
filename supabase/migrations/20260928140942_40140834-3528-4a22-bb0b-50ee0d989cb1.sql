CREATE TABLE IF NOT EXISTS public.platform_meta_tracking (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  pixel_enabled boolean NOT NULL DEFAULT true,
  capi_enabled boolean NOT NULL DEFAULT true,
  pixel_id text,
  capi_token_enc text,
  test_event_code text,
  send_user_data boolean NOT NULL DEFAULT true,
  events jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.platform_meta_tracking TO authenticated;
GRANT ALL ON public.platform_meta_tracking TO service_role;
ALTER TABLE public.platform_meta_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages main site tracking" ON public.platform_meta_tracking
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
INSERT INTO public.platform_meta_tracking (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.platform_meta_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  event_name text NOT NULL,
  source text NOT NULL DEFAULT 'server',
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  test_mode boolean NOT NULL DEFAULT false,
  user_id uuid,
  value numeric,
  error text,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_meta_events_event_uniq UNIQUE (event_name, event_id)
);
CREATE INDEX IF NOT EXISTS platform_meta_events_created_idx ON public.platform_meta_events (created_at DESC);
GRANT SELECT ON public.platform_meta_events TO authenticated;
GRANT ALL ON public.platform_meta_events TO service_role;
ALTER TABLE public.platform_meta_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads main site tracking log" ON public.platform_meta_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE TABLE IF NOT EXISTS public.platform_consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  choice text NOT NULL CHECK (choice IN ('accepted','rejected')),
  notice_version text NOT NULL,
  country text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_consent_visitor_idx ON public.platform_consent_records (visitor_id, created_at DESC);
GRANT SELECT ON public.platform_consent_records TO authenticated;
GRANT ALL ON public.platform_consent_records TO service_role;
ALTER TABLE public.platform_consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads consent records" ON public.platform_consent_records
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));