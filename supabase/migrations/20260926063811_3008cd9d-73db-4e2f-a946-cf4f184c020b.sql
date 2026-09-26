CREATE TABLE public.meta_oauth_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('messenger','whatsapp')),
  state TEXT NOT NULL UNIQUE,
  access_token_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','authorized','used','error')),
  error TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.meta_oauth_sessions TO service_role;

ALTER TABLE public.meta_oauth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages meta oauth sessions"
ON public.meta_oauth_sessions FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_meta_oauth_sessions_store ON public.meta_oauth_sessions (store_id, channel);

CREATE TRIGGER meta_oauth_sessions_updated_at
BEFORE UPDATE ON public.meta_oauth_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();