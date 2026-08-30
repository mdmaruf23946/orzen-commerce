
CREATE OR REPLACE FUNCTION public.staff_can(_store_id uuid, _section text, _level text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_store_owner(_store_id) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.store_staff s
      WHERE s.store_id = _store_id
        AND s.user_id = auth.uid()
        AND s.status = 'active'
        AND (
          (_level = 'view' AND coalesce(s.permissions->>_section, 'none') IN ('view','manage'))
          OR (_level = 'manage' AND coalesce(s.permissions->>_section, 'none') = 'manage')
        )
    )
  END
$$;

REVOKE EXECUTE ON FUNCTION public.staff_can(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_can(uuid, text, text) TO authenticated, service_role;

DO $do$
DECLARE
  m record;
  maps text[][] := ARRAY[
    ['admin_notifications','inbox'],
    ['ai_call_queue','ai_call_center'],
    ['ai_call_transcripts','ai_call_center'],
    ['ai_calls','ai_call_center'],
    ['ai_conversations','messenger_inbox'],
    ['banners','banners'],
    ['calls','call_center'],
    ['categories','categories'],
    ['coupon_redemptions','coupons'],
    ['coupons','coupons'],
    ['courier_api_logs','parcels'],
    ['courier_parcel_events','parcels'],
    ['courier_parcels','parcels'],
    ['courier_pickup_requests','parcels'],
    ['customer_notes','customers'],
    ['store_customers','customers'],
    ['store_customer_addresses','customers'],
    ['delivery_zones','delivery'],
    ['digital_entitlements','orders'],
    ['digital_licenses','orders'],
    ['expenses','finance'],
    ['facebook_comments','facebook'],
    ['facebook_moderation_queue','facebook'],
    ['facebook_posts','facebook'],
    ['fraud_checks','orders'],
    ['landing_page_logs','landing_pages'],
    ['landing_pages','landing_pages'],
    ['low_stock_alerts','low_stock'],
    ['messenger_notes','messenger_inbox'],
    ['saved_replies','messenger_inbox'],
    ['notification_recipients','notifications'],
    ['order_internal_notes','orders'],
    ['order_timeline','orders'],
    ['orders','orders'],
    ['payments','orders'],
    ['product_import_export_history','import_export'],
    ['products','products'],
    ['return_items','returns'],
    ['return_timeline','returns'],
    ['returns','returns'],
    ['service_order_assignments','orders'],
    ['service_order_deliverables','orders'],
    ['service_order_files','orders'],
    ['service_order_meetings','orders'],
    ['service_order_progress','orders'],
    ['service_order_reviews','orders'],
    ['service_order_revisions','orders'],
    ['service_order_updates','orders'],
    ['stock_movements','inventory'],
    ['store_duplicate_blocks','duplicate_protection'],
    ['support_tickets','support'],
    ['whatsapp_templates','whatsapp']
  ];
  i int;
  tbl text;
  sec text;
BEGIN
  FOR i IN 1 .. array_length(maps, 1) LOOP
    tbl := maps[i][1];
    sec := maps[i][2];
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'employees access ' || tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.staff_can(store_id, %L, ''view''))',
      'employees view ' || tbl, tbl, sec);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.staff_can(store_id, %L, ''manage''))',
      'employees insert ' || tbl, tbl, sec);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.staff_can(store_id, %L, ''manage'')) WITH CHECK (public.staff_can(store_id, %L, ''manage''))',
      'employees update ' || tbl, tbl, sec, sec);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.staff_can(store_id, %L, ''manage''))',
      'employees delete ' || tbl, tbl, sec);
  END LOOP;
END
$do$;

-- Child tables scoped through their parent
DROP POLICY IF EXISTS "employees access order_items" ON public.order_items;
CREATE POLICY "employees view order_items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.staff_can(o.store_id, 'orders', 'view')));
CREATE POLICY "employees write order_items" ON public.order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.staff_can(o.store_id, 'orders', 'manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.staff_can(o.store_id, 'orders', 'manage')));

DROP POLICY IF EXISTS "employees access ai_messages" ON public.ai_messages;
CREATE POLICY "employees view ai_messages" ON public.ai_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = ai_messages.conversation_id AND public.staff_can(c.store_id, 'messenger_inbox', 'view')));
CREATE POLICY "employees write ai_messages" ON public.ai_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = ai_messages.conversation_id AND public.staff_can(c.store_id, 'messenger_inbox', 'manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = ai_messages.conversation_id AND public.staff_can(c.store_id, 'messenger_inbox', 'manage')));

-- Read cursors are per-user read markers: any employee with inbox view may write their own
DROP POLICY IF EXISTS "employees access admin_read_cursors" ON public.admin_read_cursors;
CREATE POLICY "employees own read cursors" ON public.admin_read_cursors FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.staff_can(store_id, 'inbox', 'view'))
  WITH CHECK (user_id = auth.uid() AND public.staff_can(store_id, 'inbox', 'view'));
