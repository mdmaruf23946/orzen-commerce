-- 1. Email tables: scope policies to the service role grantee explicitly
DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;
CREATE POLICY "service role manages send log" ON public.email_send_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
CREATE POLICY "service role manages unsubscribe tokens" ON public.email_unsubscribe_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
CREATE POLICY "service role manages suppressed emails" ON public.suppressed_emails FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.email_send_log FROM anon, authenticated;
REVOKE ALL ON public.email_unsubscribe_tokens FROM anon, authenticated;
REVOKE ALL ON public.suppressed_emails FROM anon, authenticated;
GRANT ALL ON public.email_send_log TO service_role;
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;
GRANT ALL ON public.suppressed_emails TO service_role;

-- 2. Landing page credentials: write-only for owners, never readable by clients
DROP POLICY IF EXISTS "owner manages lp credentials" ON public.landing_page_credentials;
CREATE POLICY "owner inserts lp credentials" ON public.landing_page_credentials FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.landing_page_connections c WHERE c.id = connection_id AND public.is_store_owner(c.store_id)));
CREATE POLICY "owner updates lp credentials" ON public.landing_page_credentials FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.landing_page_connections c WHERE c.id = connection_id AND public.is_store_owner(c.store_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.landing_page_connections c WHERE c.id = connection_id AND public.is_store_owner(c.store_id)));
CREATE POLICY "owner deletes lp credentials" ON public.landing_page_credentials FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.landing_page_connections c WHERE c.id = connection_id AND public.is_store_owner(c.store_id)));
REVOKE SELECT ON public.landing_page_credentials FROM anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.landing_page_credentials TO authenticated;
GRANT ALL ON public.landing_page_credentials TO service_role;

-- 3. digital_downloads: IP/device data readable by the store owner only
DROP POLICY IF EXISTS "employees access digital_downloads" ON public.digital_downloads;
CREATE POLICY "employees log digital downloads" ON public.digital_downloads FOR INSERT TO authenticated
WITH CHECK (public.is_store_employee(store_id));

-- 4. Stop broadcasting payment webhook events over realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payment_webhook_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.payment_webhook_events';
  END IF;
END $$;

-- 5. Internal domain verification helper is server-only now
REVOKE EXECUTE ON FUNCTION public.domain_token_exists(text) FROM anon, authenticated;