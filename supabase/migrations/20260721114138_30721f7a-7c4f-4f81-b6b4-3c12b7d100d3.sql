
-- Allow platform owner to manage store-assets objects under _template/ prefix
CREATE POLICY "owner manages template media - read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = '_template' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "owner manages template media - insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = '_template' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "owner manages template media - update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = '_template' AND public.has_role(auth.uid(), 'owner'))
  WITH CHECK (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = '_template' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "owner manages template media - delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = '_template' AND public.has_role(auth.uid(), 'owner'));

-- Store extended product metadata (variants, tags, shipping dims, video, seo, visibility) that has no dedicated column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;
