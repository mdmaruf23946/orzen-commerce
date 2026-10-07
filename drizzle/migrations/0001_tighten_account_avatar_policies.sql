ALTER POLICY "Account owners and staff update own avatar"
ON storage.objects
USING (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[2] = 'profiles'
  AND (storage.foldername(name))[3] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND (
        s.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.store_staff ss
          WHERE ss.store_id = s.id
            AND ss.user_id = auth.uid()
            AND ss.status = 'active'
        )
      )
  )
)
WITH CHECK (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[2] = 'profiles'
  AND (storage.foldername(name))[3] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND (
        s.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.store_staff ss
          WHERE ss.store_id = s.id
            AND ss.user_id = auth.uid()
            AND ss.status = 'active'
        )
      )
  )
);

ALTER POLICY "Account owners and staff delete own avatar"
ON storage.objects
USING (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[2] = 'profiles'
  AND (storage.foldername(name))[3] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND (
        s.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.store_staff ss
          WHERE ss.store_id = s.id
            AND ss.user_id = auth.uid()
            AND ss.status = 'active'
        )
      )
  )
);