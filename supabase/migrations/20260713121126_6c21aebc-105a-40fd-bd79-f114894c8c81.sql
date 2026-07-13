
-- Announcements: enforce audience
DROP POLICY IF EXISTS "announce read published" ON public.announcements;
CREATE POLICY "announce read published all" ON public.announcements
  FOR SELECT
  USING (
    published_at IS NOT NULL
    AND published_at <= now()
    AND audience = 'all'
  );
CREATE POLICY "announce read published owner" ON public.announcements
  FOR SELECT TO authenticated
  USING (
    published_at IS NOT NULL
    AND published_at <= now()
    AND audience <> 'all'
    AND has_role(auth.uid(), 'owner'::app_role)
  );

-- Coupon redemptions: validate insert
DROP POLICY IF EXISTS "checkout inserts redemptions" ON public.coupon_redemptions;
CREATE POLICY "checkout inserts redemptions" ON public.coupon_redemptions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = coupon_redemptions.order_id
        AND o.store_id = coupon_redemptions.store_id
    )
    AND EXISTS (
      SELECT 1 FROM public.coupons c
      WHERE c.id = coupon_redemptions.coupon_id
        AND c.store_id = coupon_redemptions.store_id
    )
  );

-- Platform billing settings: authenticated only
DROP POLICY IF EXISTS "Anyone can read billing settings" ON public.platform_billing_settings;
CREATE POLICY "Authenticated can read billing settings"
  ON public.platform_billing_settings
  FOR SELECT TO authenticated
  USING (true);

-- Platform settings: owner only
DROP POLICY IF EXISTS "settings read all" ON public.platform_settings;
CREATE POLICY "settings owner read"
  ON public.platform_settings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

-- SECURITY DEFINER function grants: lock down by default, re-grant where needed
REVOKE EXECUTE ON FUNCTION public.refresh_store_subscription_status(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_trials() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_no(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_trial_for_store() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
-- has_role / is_store_owner used inside RLS expressions — keep anon+authenticated
-- get_public_order / get_store_bestsellers used by public storefront — keep anon+authenticated
