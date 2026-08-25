-- 1. Extend store_staff into the employee model
ALTER TABLE public.store_staff
  ADD COLUMN IF NOT EXISTS employee_code text,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS store_staff_store_code_uidx
  ON public.store_staff(store_id, employee_code) WHERE employee_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS store_staff_user_idx ON public.store_staff(user_id);

-- 2. Access helpers
CREATE OR REPLACE FUNCTION public.staff_store_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT store_id FROM public.store_staff
   WHERE user_id = _user_id AND status = 'active'
   ORDER BY created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_store_employee(_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_staff
     WHERE store_id = _store_id AND user_id = auth.uid() AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_store_access(_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.store_staff
                  WHERE store_id = _store_id AND user_id = auth.uid() AND status = 'active')
$$;

GRANT EXECUTE ON FUNCTION public.staff_store_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_employee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_store_access(uuid) TO authenticated;

-- 3. Employees can read their own staff row (needed to resolve their store)
DROP POLICY IF EXISTS "staff read own row" ON public.store_staff;
CREATE POLICY "staff read own row" ON public.store_staff
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 4. Activity log
CREATE TABLE IF NOT EXISTS public.staff_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_staff_id uuid REFERENCES public.store_staff(id) ON DELETE SET NULL,
  actor_name text NOT NULL DEFAULT 'Unknown',
  actor_kind text NOT NULL DEFAULT 'employee',
  section text NOT NULL DEFAULT 'general',
  action text NOT NULL,
  entity_type text,
  entity_id text,
  summary text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_activity_store_time_idx
  ON public.staff_activity_log(store_id, created_at DESC);

GRANT SELECT, INSERT ON public.staff_activity_log TO authenticated;
GRANT ALL ON public.staff_activity_log TO service_role;
ALTER TABLE public.staff_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store people read activity" ON public.staff_activity_log
  FOR SELECT TO authenticated USING (public.has_store_access(store_id));
CREATE POLICY "store people write activity" ON public.staff_activity_log
  FOR INSERT TO authenticated WITH CHECK (public.has_store_access(store_id));

-- 5. Employee access to operational tables (added alongside existing owner policies)
DO $$
DECLARE t text;
  tables text[] := ARRAY[
    'orders','order_timeline','order_internal_notes','products','categories',
    'stock_movements','low_stock_alerts','returns','return_items','return_timeline',
    'coupons','coupon_redemptions','courier_parcels','courier_parcel_events',
    'courier_pickup_requests','courier_api_logs','expenses','delivery_zones','banners',
    'customer_notes','store_customers','store_customer_addresses',
    'ai_conversations','ai_calls','ai_call_queue','ai_call_transcripts',
    'facebook_comments','facebook_moderation_queue','facebook_posts',
    'messenger_notes','saved_replies','admin_notifications','admin_read_cursors',
    'service_order_assignments','service_order_deliverables','service_order_files',
    'service_order_meetings','service_order_progress','service_order_reviews',
    'service_order_revisions','service_order_updates',
    'digital_downloads','digital_entitlements','digital_licenses',
    'landing_pages','landing_page_logs','calls','support_tickets',
    'product_import_export_history','fraud_checks','whatsapp_templates',
    'store_duplicate_blocks','notification_recipients','payments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "employees access %1$s" ON public.%1$I', t);
      EXECUTE format(
        'CREATE POLICY "employees access %1$s" ON public.%1$I FOR ALL TO authenticated
           USING (public.is_store_employee(store_id))
           WITH CHECK (public.is_store_employee(store_id))', t);
    END IF;
  END LOOP;
END $$;

-- order_items and ai_messages are scoped through their parent rows
DROP POLICY IF EXISTS "employees access order_items" ON public.order_items;
CREATE POLICY "employees access order_items" ON public.order_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.is_store_employee(o.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.is_store_employee(o.store_id)));

DROP POLICY IF EXISTS "employees access ai_messages" ON public.ai_messages;
CREATE POLICY "employees access ai_messages" ON public.ai_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND public.is_store_employee(c.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND public.is_store_employee(c.store_id)));

-- Employees may read (not change) their store's record and settings needed by the panel
DROP POLICY IF EXISTS "employees read their store" ON public.stores;
CREATE POLICY "employees read their store" ON public.stores
  FOR SELECT TO authenticated USING (public.is_store_employee(id));

DO $$
DECLARE t text;
  ro text[] := ARRAY[
    'store_return_settings','store_invoice_settings','store_invoice_profile',
    'service_workflow_settings','service_checkout_settings','service_intake_fields',
    'store_ai_config','store_ai_agents','messenger_integrations','whatsapp_integrations',
    'facebook_page_integrations','facebook_ai_settings','store_duplicate_protection',
    'invoice_templates','store_legal_info'
  ];
BEGIN
  FOREACH t IN ARRAY ro LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "employees read %1$s" ON public.%1$I', t);
      EXECUTE format(
        'CREATE POLICY "employees read %1$s" ON public.%1$I FOR SELECT TO authenticated
           USING (public.is_store_employee(store_id))', t);
    END IF;
  END LOOP;
END $$;