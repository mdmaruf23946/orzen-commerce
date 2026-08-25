-- 1. Voice catalog: scope to merchants (owners) and active employees only
DROP POLICY IF EXISTS "store admins read active voices" ON public.ai_call_voices;
CREATE POLICY "merchants read active voices"
ON public.ai_call_voices
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.store_staff st WHERE st.user_id = auth.uid() AND st.status = 'active')
    OR public.has_role(auth.uid(), 'owner'::app_role)
  )
);

-- 2. Role audit log: stricter insert constraints
DROP POLICY IF EXISTS "Owners can insert role audit log" ON public.role_audit_log;
CREATE POLICY "Owners can insert role audit log"
ON public.role_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'owner'::app_role)
  AND actor_user_id = auth.uid()
  AND target_user_id IS NOT NULL
  AND target_user_id <> auth.uid()
  AND action IN ('granted', 'revoked')
  AND role IS NOT NULL
);

-- 3. staff_store_id: only resolve the caller's own staff store
CREATE OR REPLACE FUNCTION public.staff_store_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT store_id FROM public.store_staff
   WHERE user_id = _user_id
     AND (auth.uid() IS NULL OR _user_id = auth.uid())
     AND status = 'active'
   ORDER BY created_at LIMIT 1
$function$;

-- 4. Remove anonymous EXECUTE on internal-only helpers
REVOKE ALL ON FUNCTION public.is_slug_taken(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_slug_taken(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_landing_slug_taken(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_landing_slug_taken(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.staff_store_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_store_id(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.refresh_store_subscription_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_store_subscription_status(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_messenger_daily_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_messenger_daily_stats(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_store_template_for_seed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_template_for_seed() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_billing_discounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_billing_discounts() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_active_ads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_active_ads() TO authenticated, service_role;

-- 5. Digital/returns tables: explicitly deny anonymous table access
REVOKE ALL ON public.digital_downloads FROM anon;
REVOKE ALL ON public.digital_entitlements FROM anon;
REVOKE ALL ON public.returns FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_downloads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_entitlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.digital_downloads TO service_role;
GRANT ALL ON public.digital_entitlements TO service_role;
GRANT ALL ON public.returns TO service_role;