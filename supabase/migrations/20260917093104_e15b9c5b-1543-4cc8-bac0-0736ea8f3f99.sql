-- Additive execute-privilege repair: ensure the trusted server role can run every public function.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT 'public.' || quote_ident(p.proname) || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT has_function_privilege('service_role', p.oid, 'execute')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;