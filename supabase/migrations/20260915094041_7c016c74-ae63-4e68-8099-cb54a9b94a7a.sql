DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.staff_can(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.staff_can(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_can(uuid, text, text) TO authenticated, service_role;