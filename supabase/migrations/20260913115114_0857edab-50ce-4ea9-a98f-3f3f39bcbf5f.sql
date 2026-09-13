CREATE TABLE IF NOT EXISTS public.ai_admin_messenger_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  status text NOT NULL DEFAULT 'disconnected',
  page_id text,
  page_name text,
  verify_token text,
  admin_psids text[] NOT NULL DEFAULT '{}',
  credentials_enc text,
  credentials_hint text,
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_admin_messenger_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_messenger_connections TO authenticated;

ALTER TABLE public.ai_admin_messenger_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage AI admin messenger connection"
ON public.ai_admin_messenger_connections FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_ai_admin_messenger_connections_updated_at
BEFORE UPDATE ON public.ai_admin_messenger_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_admin_messenger_connections (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;