-- Internal email queue plumbing: only service_role / cron should call these
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated;

-- Trigger-only functions must never be invokable through the API
REVOKE EXECUTE ON FUNCTION public.enqueue_order_notification() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_invoice_template_single_default() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_low_stock_check() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_stores_default_invoice_settings() FROM anon, authenticated;

-- Internal session-token minting; must only be reachable via customer_login/customer_signup
REVOKE EXECUTE ON FUNCTION public._new_session_token(uuid, uuid, text, text) FROM anon, authenticated;

-- Seed template is only needed while creating a store (signed-in flow)
REVOKE EXECUTE ON FUNCTION public.get_store_template_for_seed() FROM anon;