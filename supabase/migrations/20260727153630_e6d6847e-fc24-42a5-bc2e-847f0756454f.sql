-- Gmail metadata (no tokens)
CREATE TABLE IF NOT EXISTS public.owner_gmail_state (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_email text,
  google_account_name text,
  connected_at timestamptz,
  last_tested_at timestamptz,
  last_test_ok boolean,
  last_test_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_gmail_state TO authenticated;
GRANT ALL ON public.owner_gmail_state TO service_role;
ALTER TABLE public.owner_gmail_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_gmail_state owner rw"
  ON public.owner_gmail_state FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Reusable message templates
CREATE TABLE IF NOT EXISTS public.owner_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  notification_title text,
  notification_body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_message_templates TO authenticated;
GRANT ALL ON public.owner_message_templates TO service_role;
ALTER TABLE public.owner_message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_message_templates owner rw"
  ON public.owner_message_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE OR REPLACE TRIGGER trg_owner_message_templates_updated
BEFORE UPDATE ON public.owner_message_templates
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Extend notification_recipients + notification_campaigns
ALTER TABLE public.notification_recipients
  ADD COLUMN IF NOT EXISTS variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sent_via text,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

ALTER TABLE public.notification_campaigns
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS notification_body text;

-- Security fix: hide password_hash from authenticated readers.
-- Store owners can still read customer rows for management; the
-- password_hash column is now only readable by service_role/admin code.
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'store_customers'
     AND column_name <> 'password_hash';
  EXECUTE 'REVOKE SELECT ON public.store_customers FROM authenticated';
  EXECUTE 'GRANT SELECT (' || cols || ') ON public.store_customers TO authenticated';
  EXECUTE 'GRANT INSERT, UPDATE, DELETE ON public.store_customers TO authenticated';
END $$;