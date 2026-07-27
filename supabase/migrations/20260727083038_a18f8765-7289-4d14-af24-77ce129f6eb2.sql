
-- Extend admin_notifications with campaign metadata (additive)
ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS action_label text,
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS action_target text,
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- notification_campaigns
CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal',
  channels text[] NOT NULL DEFAULT ARRAY['email','in_app']::text[],
  action_label text,
  action_type text,
  action_target text,
  audience_kind text NOT NULL DEFAULT 'all',
  audience_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  scheduled_tz text,
  created_by uuid,
  sent_at timestamptz,
  completed_at timestamptz,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_campaigns TO authenticated;
GRANT ALL ON public.notification_campaigns TO service_role;
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage campaigns" ON public.notification_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER trg_notification_campaigns_updated_at
  BEFORE UPDATE ON public.notification_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- notification_recipients
CREATE TABLE IF NOT EXISTS public.notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.notification_campaigns(id) ON DELETE CASCADE,
  store_id uuid,
  user_id uuid NOT NULL,
  email text,
  email_status text NOT NULL DEFAULT 'pending',
  email_message_id text,
  email_last_error text,
  email_attempts integer NOT NULL DEFAULT 0,
  inapp_notification_id uuid,
  inapp_status text NOT NULL DEFAULT 'pending',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_recipients_user ON public.notification_recipients(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notif_recipients_campaign ON public.notification_recipients(campaign_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_recipients TO authenticated;
GRANT ALL ON public.notification_recipients TO service_role;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage recipients" ON public.notification_recipients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "recipients read own row" ON public.notification_recipients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "recipients update own read state" ON public.notification_recipients
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_notification_recipients_updated_at
  BEFORE UPDATE ON public.notification_recipients
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- notification_templates
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal',
  title text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  action_label text,
  action_type text,
  action_target text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage templates" ON public.notification_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER trg_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Enable realtime for admin_notifications (safe if already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
