
-- 1. Drop overly permissive INSERT policies (checkout now uses service role)
DROP POLICY IF EXISTS "orders insert active store" ON public.orders;
DROP POLICY IF EXISTS "order items insert for valid order" ON public.order_items;
DROP POLICY IF EXISTS "checkout inserts redemptions" ON public.coupon_redemptions;

-- 2. Fix store_ai_agents public-read policy (was USING (true))
DROP POLICY IF EXISTS "Public can read enabled agents" ON public.store_ai_agents;
-- Store owners can still manage; service role (used by chat) bypasses RLS.
-- No public SELECT policy needed since AI chat reads via service role.

-- 3. Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.refresh_store_subscription_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_no(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_trial_for_store() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_trials() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_order_status_change() FROM PUBLIC, anon, authenticated;

-- Keep these callable (used by policies / public storefront RPCs):
-- has_role, is_store_owner: referenced by RLS policies; callers need EXECUTE.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_owner(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_order(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_bestsellers(uuid, integer) TO anon, authenticated;
