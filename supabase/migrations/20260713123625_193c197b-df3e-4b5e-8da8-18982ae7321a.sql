
ALTER TABLE public.platform_feature_flags
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

INSERT INTO public.platform_feature_flags (flag_key, enabled, description, category, label, sort_order) VALUES
  ('ai_agent',        false, 'AI Sales Agent for storefront',       'ai',        'AI Sales Agent',           10),
  ('ai_messenger',    false, 'AI Messenger auto-replies',            'ai',        'AI Messenger',             20),
  ('pixel',           false, 'Facebook Pixel & tracking',            'marketing', 'Facebook Pixel & Tracking',30),
  ('courier',         false, 'Courier integration',                  'ops',       'Courier Integration',      40),
  ('inventory',       false, 'Inventory management',                 'ops',       'Inventory Management',     50),
  ('coupons',         false, 'Coupons & discounts',                  'marketing', 'Coupons & Discounts',      60),
  ('invoice',         false, 'Invoices',                             'ops',       'Invoices',                 70),
  ('analytics',       false, 'Analytics',                            'insights',  'Analytics',                80),
  ('import_export',   false, 'Import / Export',                      'ops',       'Import / Export',          90),
  ('bulk_actions',    false, 'Bulk actions',                         'ops',       'Bulk Actions',            100),
  ('staff',           false, 'Staff management',                     'team',      'Staff Management',        110),
  ('customer_notes',  false, 'Customer notes',                       'ops',       'Customer Notes',          120),
  ('returns',         false, 'Returns & exchanges',                  'ops',       'Returns & Exchanges',     130)
ON CONFLICT (flag_key) DO UPDATE
  SET label = COALESCE(public.platform_feature_flags.label, EXCLUDED.label),
      sort_order = CASE WHEN public.platform_feature_flags.sort_order = 0 THEN EXCLUDED.sort_order ELSE public.platform_feature_flags.sort_order END,
      category = COALESCE(public.platform_feature_flags.category, EXCLUDED.category);

-- Security fix: restrict platform_payment_settings SELECT to owner only
DROP POLICY IF EXISTS "authenticated read payment settings" ON public.platform_payment_settings;
DROP POLICY IF EXISTS "owner read payment settings" ON public.platform_payment_settings;
CREATE POLICY "owner read payment settings"
  ON public.platform_payment_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role));
