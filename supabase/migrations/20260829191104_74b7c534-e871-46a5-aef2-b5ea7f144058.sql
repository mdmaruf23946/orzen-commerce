-- 1) Remove the stray store created for an employee login
DELETE FROM public.stores s
WHERE s.owner_user_id IN (SELECT user_id FROM public.store_staff WHERE user_id IS NOT NULL);

-- 2) Prevent any future store from being owned by a staff account
CREATE OR REPLACE FUNCTION public.tg_block_staff_owned_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.store_staff st WHERE st.user_id = NEW.owner_user_id
  ) THEN
    RAISE EXCEPTION 'This account is an employee account and cannot own a store';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_staff_owned_store ON public.stores;
CREATE TRIGGER block_staff_owned_store
BEFORE INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.tg_block_staff_owned_store();