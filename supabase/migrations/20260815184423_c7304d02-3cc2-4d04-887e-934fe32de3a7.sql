-- Storage needs to be able to resolve the bucket row for the anon role before
-- the object-level policy is evaluated.
DROP POLICY IF EXISTS "store-assets bucket is discoverable" ON storage.buckets;

CREATE POLICY "store-assets bucket is discoverable"
ON storage.buckets
FOR SELECT
TO anon, authenticated
USING (id = 'store-assets');