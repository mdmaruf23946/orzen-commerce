GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_messenger_connections TO authenticated;
GRANT ALL ON public.ai_admin_messenger_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_connections TO authenticated;
GRANT ALL ON public.ai_admin_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_threads TO authenticated;
GRANT ALL ON public.ai_admin_threads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_admin_messages TO authenticated;
GRANT ALL ON public.ai_admin_messages TO service_role;