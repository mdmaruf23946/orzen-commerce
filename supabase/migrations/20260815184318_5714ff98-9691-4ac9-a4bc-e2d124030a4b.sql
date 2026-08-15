-- Allow public (anonymous) read access to PUBLIC IMAGE assets in store-assets only.
-- Paid digital files ({storeId}/digital/...), return evidence and other private
-- folders stay unreadable. This lets the /api/img proxy work on self-hosted
-- deployments (Cloudflare Pages) that do not have the service role key.
DROP POLICY IF EXISTS "public image assets are readable" ON storage.objects;

CREATE POLICY "public image assets are readable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'store-assets'
  AND lower(storage.extension(name)) IN ('png','jpg','jpeg','webp','gif','avif','svg','ico','bmp')
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(string_to_array(lower(name), '/')) AS seg
    WHERE seg IN ('digital','private','downloads','deliverables','invoices','secure','returns')
  )
);