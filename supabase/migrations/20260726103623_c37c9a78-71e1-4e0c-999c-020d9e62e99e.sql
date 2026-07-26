
ALTER TABLE public.platform_payment_gateways ADD COLUMN IF NOT EXISTS wordmark_url text;

CREATE POLICY "owners manage payment brand assets - insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] = 'brand-logos'
  AND (storage.foldername(name))[2] = 'payment'
  AND public.has_role(auth.uid(), 'owner')
);

CREATE POLICY "owners manage payment brand assets - read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] = 'brand-logos'
  AND (storage.foldername(name))[2] = 'payment'
  AND public.has_role(auth.uid(), 'owner')
);

CREATE POLICY "owners manage payment brand assets - update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] = 'brand-logos'
  AND (storage.foldername(name))[2] = 'payment'
  AND public.has_role(auth.uid(), 'owner')
)
WITH CHECK (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] = 'brand-logos'
  AND (storage.foldername(name))[2] = 'payment'
  AND public.has_role(auth.uid(), 'owner')
);

CREATE POLICY "owners manage payment brand assets - delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] = 'brand-logos'
  AND (storage.foldername(name))[2] = 'payment'
  AND public.has_role(auth.uid(), 'owner')
);
