
-- ============================================================
-- 1. Tables
-- ============================================================

CREATE TABLE public.store_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_customers_identifier_chk CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE UNIQUE INDEX store_customers_store_email_uq
  ON public.store_customers (store_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX store_customers_store_phone_uq
  ON public.store_customers (store_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX store_customers_store_idx ON public.store_customers (store_id);

GRANT SELECT, UPDATE, DELETE ON public.store_customers TO authenticated;
GRANT ALL ON public.store_customers TO service_role;
ALTER TABLE public.store_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners read own customers" ON public.store_customers
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Store owners update own customers" ON public.store_customers
  FOR UPDATE TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));
CREATE POLICY "Store owners delete own customers" ON public.store_customers
  FOR DELETE TO authenticated
  USING (public.is_store_owner(store_id));

CREATE TABLE public.store_customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.store_customers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  label text,
  name text,
  phone text,
  address text NOT NULL,
  area text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_customer_addresses_cust_idx
  ON public.store_customer_addresses (customer_id);

GRANT SELECT ON public.store_customer_addresses TO authenticated;
GRANT ALL ON public.store_customer_addresses TO service_role;
ALTER TABLE public.store_customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners read customer addresses" ON public.store_customer_addresses
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'owner'));

CREATE TABLE public.store_customer_sessions (
  token_hash text PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.store_customers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  user_agent text,
  ip text
);
CREATE INDEX store_customer_sessions_cust_idx
  ON public.store_customer_sessions (customer_id);

GRANT ALL ON public.store_customer_sessions TO service_role;
ALTER TABLE public.store_customer_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Column additions
-- ============================================================

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS require_customer_login boolean NOT NULL DEFAULT false;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.store_customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders (customer_id);

-- ============================================================
-- 3. updated_at trigger
-- ============================================================

CREATE TRIGGER trg_store_customers_updated
  BEFORE UPDATE ON public.store_customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_store_customer_addresses_updated
  BEFORE UPDATE ON public.store_customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 4. Helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public._normalize_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(regexp_replace(coalesce(_phone,''), '[^0-9]', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public._new_session_token(_customer_id uuid, _store_id uuid, _ua text, _ip text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _token text;
  _hash text;
BEGIN
  _token := encode(extensions.gen_random_bytes(32), 'hex');
  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');
  INSERT INTO public.store_customer_sessions(token_hash, customer_id, store_id, expires_at, user_agent, ip)
    VALUES (_hash, _customer_id, _store_id, now() + interval '90 days', _ua, _ip);
  RETURN _token;
END $$;

-- ============================================================
-- 5. RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION public.customer_signup(
  _store_id uuid, _name text, _email text, _phone text, _password text,
  _ua text DEFAULT NULL, _ip text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
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

  INSERT INTO public.store_customers(store_id, full_name, email, phone, password_hash, last_login_at)
    VALUES (_store_id, trim(_name), _e, _p, extensions.crypt(_password, extensions.gen_salt('bf', 10)), now())
    RETURNING id INTO _cid;

  _token := public._new_session_token(_cid, _store_id, _ua, _ip);
  RETURN jsonb_build_object(
    'ok', true, 'token', _token,
    'customer', jsonb_build_object('id', _cid, 'full_name', trim(_name), 'email', _e, 'phone', _p)
  );
END $$;

CREATE OR REPLACE FUNCTION public.customer_login(
  _store_id uuid, _identifier text, _password text, _ua text DEFAULT NULL, _ip text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE _c record; _id text; _phone text; _token text;
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
  IF _c.password_hash <> extensions.crypt(_password, _c.password_hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid credentials');
  END IF;
  UPDATE public.store_customers SET last_login_at = now() WHERE id = _c.id;
  _token := public._new_session_token(_c.id, _store_id, _ua, _ip);
  RETURN jsonb_build_object(
    'ok', true, 'token', _token,
    'customer', jsonb_build_object('id', _c.id, 'full_name', _c.full_name, 'email', _c.email, 'phone', _c.phone)
  );
END $$;

CREATE OR REPLACE FUNCTION public.customer_logout(_token text)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path = public, extensions
AS $$
  DELETE FROM public.store_customer_sessions
    WHERE token_hash = encode(extensions.digest(_token, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.customer_from_token(_token text, _store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE _c record;
BEGIN
  SELECT c.id, c.full_name, c.email, c.phone, c.is_active, c.store_id
    INTO _c
    FROM public.store_customer_sessions s
    JOIN public.store_customers c ON c.id = s.customer_id
   WHERE s.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
     AND s.store_id = _store_id
     AND s.expires_at > now()
   LIMIT 1;
  IF NOT FOUND OR NOT _c.is_active THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', _c.id, 'store_id', _c.store_id,
    'full_name', _c.full_name, 'email', _c.email, 'phone', _c.phone
  );
END $$;

CREATE OR REPLACE FUNCTION public.customer_change_password(
  _token text, _store_id uuid, _old text, _new text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE _c record;
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
  IF _c.password_hash <> extensions.crypt(_old, _c.password_hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Current password is incorrect');
  END IF;
  UPDATE public.store_customers
     SET password_hash = extensions.crypt(_new, extensions.gen_salt('bf', 10))
   WHERE id = _c.id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.customer_update_profile(
  _token text, _store_id uuid, _name text, _email text, _phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE _c record; _e text; _p text;
BEGIN
  SELECT c.* INTO _c
    FROM public.store_customer_sessions s
    JOIN public.store_customers c ON c.id = s.customer_id
   WHERE s.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
     AND s.store_id = _store_id AND s.expires_at > now()
   LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Not signed in'); END IF;
  _e := NULLIF(lower(trim(coalesce(_email,''))), '');
  _p := public._normalize_phone(_phone);
  IF _e IS NULL AND _p IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Email or phone is required');
  END IF;
  IF _e IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.store_customers
     WHERE store_id = _store_id AND lower(email) = _e AND id <> _c.id
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'Email already registered'); END IF;
  IF _p IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.store_customers
     WHERE store_id = _store_id AND phone = _p AND id <> _c.id
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'Phone already registered'); END IF;
  UPDATE public.store_customers
     SET full_name = coalesce(NULLIF(trim(_name),''), full_name),
         email = _e, phone = _p
   WHERE id = _c.id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ============================================================
-- 6. Public store fetch: include require_customer_login
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_store_by_slug(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'name', s.name, 'description', s.description,
    'logo_url', s.logo_url, 'phone', s.phone, 'whatsapp', s.whatsapp,
    'facebook', s.facebook, 'address', s.address,
    'primary_color', s.primary_color, 'header_color', s.header_color,
    'title_bar_color', s.title_bar_color, 'footer_color', s.footer_color,
    'button_color', s.button_color, 'bkash_number', s.bkash_number,
    'nagad_number', s.nagad_number, 'status', s.status::text,
    'marketing', COALESCE(s.marketing, '{}'::jsonb) - 'fb_capi_token',
    'seo', s.seo, 'theme', s.theme, 'delivery', s.delivery,
    'payments_config', s.payments_config,
    'require_customer_login', COALESCE(s.require_customer_login, false)
  )
  FROM public.stores s
  WHERE s.slug = _slug AND s.status = 'active'
  LIMIT 1;
$$;

-- Lock down execute: only service_role
REVOKE ALL ON FUNCTION public.customer_signup(uuid,text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_login(uuid,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_logout(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_from_token(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_change_password(text,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_update_profile(text,uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._new_session_token(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_signup(uuid,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_login(uuid,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_logout(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_from_token(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_change_password(text,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_update_profile(text,uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public._new_session_token(uuid,uuid,text,text) TO service_role;
