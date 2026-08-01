DROP POLICY IF EXISTS "owner reads digital files" ON storage.objects;
CREATE POLICY "owner reads digital files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'digital-files' AND public.is_store_owner(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "owner writes digital files" ON storage.objects;
CREATE POLICY "owner writes digital files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'digital-files' AND public.is_store_owner(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "owner updates digital files" ON storage.objects;
CREATE POLICY "owner updates digital files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'digital-files' AND public.is_store_owner(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "owner deletes digital files" ON storage.objects;
CREATE POLICY "owner deletes digital files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'digital-files' AND public.is_store_owner(((storage.foldername(name))[1])::uuid));