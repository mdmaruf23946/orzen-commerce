CREATE TABLE IF NOT EXISTS public.store_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'agent',
  status text NOT NULL DEFAULT 'invited',
  notes text,
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_staff_store_idx ON public.store_staff(store_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_staff TO authenticated;
GRANT ALL ON public.store_staff TO service_role;

ALTER TABLE public.store_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store staff owner all" ON public.store_staff;
CREATE POLICY "store staff owner all" ON public.store_staff
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'owner'));

DROP TRIGGER IF EXISTS store_staff_touch ON public.store_staff;
CREATE TRIGGER store_staff_touch BEFORE UPDATE ON public.store_staff
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Store owners must be able to read replies written by the platform team.
DROP POLICY IF EXISTS "ticket msgs store owner read" ON public.ticket_messages;
CREATE POLICY "ticket msgs store owner read" ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_messages.ticket_id
        AND (t.created_by = auth.uid() OR public.is_store_owner(t.store_id))
    )
  );

INSERT INTO public.platform_feature_flags (flag_key, label, description, category, enabled, sort_order)
VALUES
  ('staff', 'Staff Management', 'Invite and manage staff members for the store', 'team', true, 40),
  ('call_center', 'Manual Call Center', 'Manual outbound/inbound call logging and dialer', 'communication', true, 41),
  ('landing_pages', 'Landing Pages', 'Standalone product landing pages and integrations', 'marketing', true, 42),
  ('ai_call_center', 'AI Call Center', 'AI voice calls for order confirmation and support', 'ai', true, 43),
  ('fraud_checker', 'Fraud Checker', 'Courier-based fraud/return-rate checking', 'operations', true, 44),
  ('custom_domain', 'Custom Domain', 'Connect a custom domain to the storefront', 'general', true, 45),
  ('bulk_actions', 'Bulk Actions', 'Bulk order and product operations', 'operations', true, 46),
  ('customer_notes', 'Customer Notes', 'Internal notes on customer profiles', 'general', true, 47),
  ('ai_product_builder', 'AI Product Builder', 'Generate product content with AI', 'ai', true, 48)
ON CONFLICT (flag_key) DO NOTHING;