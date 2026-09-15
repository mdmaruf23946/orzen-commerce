DROP POLICY IF EXISTS "contact insert anyone" ON public.contact_requests;
CREATE POLICY "contact insert anyone"
ON public.contact_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(coalesce(name, ''))) BETWEEN 2 AND 200
  AND length(coalesce(email, '')) BETWEEN 5 AND 320
  AND email ~* '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND length(btrim(coalesce(message, ''))) BETWEEN 10 AND 5000
  AND (phone IS NULL OR (length(btrim(phone)) BETWEEN 6 AND 30 AND phone ~ '^[0-9+()\-\s]+$'))
  AND coalesce(status, 'new') = 'new'
);

DROP POLICY IF EXISTS "Anyone can subscribe to a store newsletter" ON public.store_newsletter_subscribers;
CREATE POLICY "Anyone can subscribe to a store newsletter"
ON public.store_newsletter_subscribers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(coalesce(email, '')) BETWEEN 5 AND 254
  AND email ~* '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_newsletter_subscribers.store_id
      AND s.status = 'active'
  )
);