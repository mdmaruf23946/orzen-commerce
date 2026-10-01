CREATE TABLE public.ai_key_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id text NOT NULL,
  provider text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_key_usage_key_idx ON public.ai_key_usage (key_id, created_at DESC);
GRANT SELECT ON public.ai_key_usage TO authenticated;
GRANT ALL ON public.ai_key_usage TO service_role;
ALTER TABLE public.ai_key_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads key usage" ON public.ai_key_usage FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE TABLE public.ai_key_quota (
  key_id text PRIMARY KEY,
  remaining_tokens numeric,
  limit_tokens numeric,
  unit text NOT NULL DEFAULT 'tokens',
  reset_at timestamptz,
  source text NOT NULL DEFAULT 'provider',
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_key_quota TO authenticated;
GRANT ALL ON public.ai_key_quota TO service_role;
ALTER TABLE public.ai_key_quota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads key quota" ON public.ai_key_quota FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));