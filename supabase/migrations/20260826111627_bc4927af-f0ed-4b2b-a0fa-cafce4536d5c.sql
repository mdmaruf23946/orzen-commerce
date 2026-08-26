CREATE OR REPLACE FUNCTION public.customer_request_password_reset(_store_id uuid, _identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE _c record; _token text;
BEGIN
  SELECT * INTO _c FROM public.store_customers
   WHERE store_id = _store_id
     AND (lower(email) = lower(trim(_identifier))
          OR public._normalize_phone(phone) = public._normalize_phone(_identifier))
   LIMIT 1;
  -- Always report success so the endpoint cannot be used to enumerate accounts.
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true); END IF;

  UPDATE public.store_customer_reset_tokens
     SET used_at = now()
   WHERE customer_id = _c.id AND used_at IS NULL;

  _token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.store_customer_reset_tokens(store_id, customer_id, token_hash, expires_at)
  VALUES (_store_id, _c.id, encode(extensions.digest(_token, 'sha256'), 'hex'), now() + interval '30 minutes');

  RETURN jsonb_build_object('ok', true, 'token', _token, 'email', _c.email, 'phone', _c.phone, 'name', _c.full_name);
END $function$;

REVOKE EXECUTE ON FUNCTION public.customer_request_password_reset(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_request_password_reset(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.customer_reset_password(_store_id uuid, _token text, _new text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE _r record;
BEGIN
  IF length(coalesce(_new,'')) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Password must be at least 6 characters');
  END IF;
  SELECT * INTO _r FROM public.store_customer_reset_tokens
   WHERE store_id = _store_id
     AND token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
     AND used_at IS NULL AND expires_at > now()
   LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'This reset link is invalid or has expired'); END IF;

  UPDATE public.store_customer_credentials
     SET password_hash = extensions.crypt(_new, extensions.gen_salt('bf', 10)), updated_at = now()
   WHERE customer_id = _r.customer_id;
  IF NOT FOUND THEN
    INSERT INTO public.store_customer_credentials(customer_id, password_hash)
    VALUES (_r.customer_id, extensions.crypt(_new, extensions.gen_salt('bf', 10)));
  END IF;

  UPDATE public.store_customer_reset_tokens SET used_at = now() WHERE id = _r.id;
  -- Any existing session is invalidated after a password reset.
  DELETE FROM public.store_customer_sessions WHERE customer_id = _r.customer_id;
  RETURN jsonb_build_object('ok', true);
END $function$;

REVOKE EXECUTE ON FUNCTION public.customer_reset_password(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_reset_password(uuid, text, text) TO service_role;