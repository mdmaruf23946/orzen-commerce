CREATE TABLE IF NOT EXISTS public.merchant_security (
  user_id uuid PRIMARY KEY,
  email_verified_at timestamptz,
  totp_enabled boolean NOT NULL DEFAULT false,
  backup_code_hashes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.merchant_security TO authenticated;
GRANT ALL ON public.merchant_security TO service_role;

ALTER TABLE public.merchant_security ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_security_select_own" ON public.merchant_security;
CREATE POLICY "merchant_security_select_own"
  ON public.merchant_security FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS merchant_security_touch ON public.merchant_security;
CREATE TRIGGER merchant_security_touch
  BEFORE UPDATE ON public.merchant_security
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.merchant_auth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  purpose text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.merchant_auth_codes TO service_role;

ALTER TABLE public.merchant_auth_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS merchant_auth_codes_lookup
  ON public.merchant_auth_codes (user_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS merchant_auth_codes_email_lookup
  ON public.merchant_auth_codes (email, purpose, created_at DESC);