
-- 1) Tighten public storage bucket: remove blanket public SELECT (served via /api/img proxy using admin key)
DROP POLICY IF EXISTS "store assets readable" ON storage.objects;

CREATE POLICY "store owners read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'store-assets'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.owner_user_id = auth.uid()
      AND (storage.foldername(objects.name))[1] = s.id::text
  )
);

-- 2) Replace always-true INSERT policies with minimal validation checks
DROP POLICY IF EXISTS "contact insert anyone" ON public.contact_requests;
CREATE POLICY "contact insert anyone"
ON public.contact_requests FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(coalesce(name, '')) BETWEEN 1 AND 200
  AND length(coalesce(email, '')) BETWEEN 3 AND 320
  AND length(coalesce(message, '')) BETWEEN 1 AND 5000
);

DROP POLICY IF EXISTS "feedback insert anyone" ON public.feedback;
CREATE POLICY "feedback insert anyone"
ON public.feedback FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(coalesce(message, '')) BETWEEN 1 AND 5000
);

-- 3) Lock down SECURITY DEFINER function EXECUTE grants
-- Trigger-only / admin-only helpers: revoke from anon and authenticated
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_invoice_no(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_trial_for_store() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_trials() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_store_subscription_status(uuid) FROM PUBLIC, anon, authenticated;

-- Auth-only helpers used by RLS: authenticated only
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_store_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_store_owner(uuid) TO authenticated;

-- Public read helpers used by storefront (anon + authenticated)
REVOKE ALL ON FUNCTION public.get_public_store_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_store_by_slug(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_order(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.resolve_domain(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_domain(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_store_bestsellers(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_bestsellers(uuid, integer) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.is_slug_taken(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_slug_taken(text) TO anon, authenticated;
