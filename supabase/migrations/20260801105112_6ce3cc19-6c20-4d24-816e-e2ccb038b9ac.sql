-- Internal-only SECURITY DEFINER helpers: remove direct API access.
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_no(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.expire_trials() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._new_session_token(uuid, uuid, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._normalize_phone(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._default_invoice_prefix(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_store_template_for_seed() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_invoice_no(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_trials() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_store_template_for_seed() TO service_role;