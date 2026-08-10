-- 1) Public product reads limited to published products only
DROP POLICY IF EXISTS "products public read active stores" ON public.products;
CREATE POLICY "products public read active published"
ON public.products FOR SELECT TO anon
USING (public.is_store_active(store_id) AND status = 'active'::product_status);

-- 2) Template media storage policies scoped to authenticated owners
DROP POLICY IF EXISTS "owner manages template media - read" ON storage.objects;
DROP POLICY IF EXISTS "owner manages template media - insert" ON storage.objects;
DROP POLICY IF EXISTS "owner manages template media - update" ON storage.objects;
DROP POLICY IF EXISTS "owner manages template media - delete" ON storage.objects;

CREATE POLICY "owner manages template media - read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = '_template' AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "owner manages template media - insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = '_template' AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "owner manages template media - update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = '_template' AND public.has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = '_template' AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "owner manages template media - delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = '_template' AND public.has_role(auth.uid(), 'owner'::app_role));

-- 3) Customer credential/session tables: server-side only, fail closed
ALTER TABLE public.store_customer_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_customer_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_customer_sessions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.store_customer_credentials FROM anon, authenticated;
REVOKE ALL ON public.store_customer_sessions FROM anon, authenticated;
GRANT ALL ON public.store_customer_credentials TO service_role;
GRANT ALL ON public.store_customer_sessions TO service_role;