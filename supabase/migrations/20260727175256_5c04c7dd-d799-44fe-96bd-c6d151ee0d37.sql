
DROP FUNCTION IF EXISTS public.customer_signup(uuid,text,text,text,text,text,text);
DROP FUNCTION IF EXISTS public.customer_login(uuid,text,text,text,text);
DROP FUNCTION IF EXISTS public.customer_change_password(text,uuid,text,text);

CREATE OR REPLACE FUNCTION public.customer_signup(_store_id uuid, _name text, _email text, _phone text, _password text, _ua text, _ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cid uuid; _token text; _e text; _p text;
BEGIN
  IF _name IS NULL OR length(trim(_name)) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Name is required');
  END IF;
  IF _password IS NULL OR length(_password) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Password must be at least 6 characters');
  END IF;
  _e := NULLIF(lower(trim(coalesce(_email,''))), '');
  _p := public._normalize_phone(_phone);
  IF _e IS NULL AND _p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Email or phone is required');
  END IF;
  IF _e IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.store_customers WHERE store_id = _store_id AND lower(email) = _e
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'Email already registered'); END IF;
  IF _p IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.store_customers WHERE store_id = _store_id AND phone = _p
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'Phone already registered'); END IF;

  INSERT INTO public.store_customers(store_id, full_name, email, phone, last_login_at)
    VALUES (_store_id, trim(_name), _e, _p, now())
    RETURNING id INTO _cid;

  INSERT INTO public.store_customer_credentials(customer_id, password_hash)
    VALUES (_cid, extensions.crypt(_password, extensions.gen_salt('bf', 10)));

  _token := public._new_session_token(_cid, _store_id, _ua, _ip);
  RETURN jsonb_build_object(
    'ok', true, 'token', _token,
    'customer', jsonb_build_object('id', _cid, 'full_name', trim(_name), 'email', _e, 'phone', _p)
  );
END $$;

CREATE OR REPLACE FUNCTION public.customer_login(_store_id uuid, _identifier text, _password text, _ua text, _ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c record; _hash text; _id text; _phone text; _token text;
BEGIN
  _id := lower(trim(coalesce(_identifier,'')));
  _phone := public._normalize_phone(_identifier);
  SELECT * INTO _c FROM public.store_customers
    WHERE store_id = _store_id
      AND ((email IS NOT NULL AND lower(email) = _id)
        OR (phone IS NOT NULL AND _phone IS NOT NULL AND phone = _phone))
    LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid credentials'); END IF;
  IF NOT _c.is_active THEN RETURN jsonb_build_object('ok', false, 'error', 'Account is disabled'); END IF;
  SELECT password_hash INTO _hash FROM public.store_customer_credentials WHERE customer_id = _c.id;
  IF _hash IS NULL OR _hash <> extensions.crypt(_password, _hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid credentials');
  END IF;
  UPDATE public.store_customers SET last_login_at = now() WHERE id = _c.id;
  _token := public._new_session_token(_c.id, _store_id, _ua, _ip);
  RETURN jsonb_build_object(
    'ok', true, 'token', _token,
    'customer', jsonb_build_object('id', _c.id, 'full_name', _c.full_name, 'email', _c.email, 'phone', _c.phone)
  );
END $$;

CREATE OR REPLACE FUNCTION public.customer_change_password(_token text, _store_id uuid, _old text, _new text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c record; _hash text;
BEGIN
  IF length(coalesce(_new,'')) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Password must be at least 6 characters');
  END IF;
  SELECT c.* INTO _c
    FROM public.store_customer_sessions s
    JOIN public.store_customers c ON c.id = s.customer_id
   WHERE s.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
     AND s.store_id = _store_id AND s.expires_at > now()
   LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Not signed in'); END IF;
  SELECT password_hash INTO _hash FROM public.store_customer_credentials WHERE customer_id = _c.id;
  IF _hash IS NULL OR _hash <> extensions.crypt(_old, _hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Current password is incorrect');
  END IF;
  UPDATE public.store_customer_credentials
     SET password_hash = extensions.crypt(_new, extensions.gen_salt('bf', 10)),
         updated_at = now()
   WHERE customer_id = _c.id;
  RETURN jsonb_build_object('ok', true);
END $$;
