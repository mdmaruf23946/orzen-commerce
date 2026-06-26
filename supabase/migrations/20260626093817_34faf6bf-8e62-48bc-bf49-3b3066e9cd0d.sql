
CREATE POLICY "store owners upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-assets' AND
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.owner_user_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
    )
  );

CREATE POLICY "store owners update own files" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-assets' AND
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.owner_user_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
    )
  );

CREATE POLICY "store owners delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-assets' AND
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.owner_user_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
    )
  );

CREATE POLICY "store assets readable" ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets');
