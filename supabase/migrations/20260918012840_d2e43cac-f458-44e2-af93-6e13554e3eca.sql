CREATE TABLE IF NOT EXISTS public.platform_email_automations (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_email_automations TO authenticated;
GRANT ALL ON public.platform_email_automations TO service_role;

ALTER TABLE public.platform_email_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage email automations" ON public.platform_email_automations;
CREATE POLICY "Owners manage email automations"
ON public.platform_email_automations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

INSERT INTO public.platform_email_automations (key, label, description) VALUES
  ('welcome', 'Welcome email', 'Sent to a merchant right after their store is created.'),
  ('login_alert', 'Login security alert', 'Sent when someone signs in to a merchant account.'),
  ('subscription', 'Subscription & billing', 'Sent when a plan is purchased, renewed or upgraded.'),
  ('landing_page', 'Landing page published', 'Sent when a merchant publishes a new landing page.')
ON CONFLICT (key) DO NOTHING;