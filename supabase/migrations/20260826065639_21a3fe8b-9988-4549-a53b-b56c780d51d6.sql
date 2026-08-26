-- 1) staff_activity_log: force actor identity to the real caller
CREATE OR REPLACE FUNCTION public.tg_staff_activity_actor_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _staff public.store_staff%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Activity log requires an authenticated actor';
  END IF;

  SELECT * INTO _staff
  FROM public.store_staff
  WHERE user_id = _uid AND store_id = NEW.store_id AND status = 'active'
  LIMIT 1;

  IF _staff.id IS NOT NULL THEN
    NEW.actor_kind := 'employee';
    NEW.actor_staff_id := _staff.id;
    NEW.actor_user_id := _uid;
    NEW.actor_name := COALESCE(_staff.name, 'Employee');
  ELSIF public.is_store_owner(NEW.store_id) THEN
    NEW.actor_kind := 'owner';
    NEW.actor_staff_id := NULL;
    NEW.actor_user_id := _uid;
    NEW.actor_name := COALESCE(NEW.actor_name, 'Merchant (owner)');
  ELSE
    RAISE EXCEPTION 'Not allowed to write activity for this store';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_activity_actor_guard ON public.staff_activity_log;
CREATE TRIGGER staff_activity_actor_guard
BEFORE INSERT ON public.staff_activity_log
FOR EACH ROW EXECUTE FUNCTION public.tg_staff_activity_actor_guard();

REVOKE UPDATE, DELETE ON public.staff_activity_log FROM authenticated;

-- 2) role_audit_log: no direct client inserts; trusted server only
DROP POLICY IF EXISTS "Owners can insert role audit log" ON public.role_audit_log;
REVOKE INSERT, UPDATE, DELETE ON public.role_audit_log FROM authenticated;
GRANT ALL ON public.role_audit_log TO service_role;