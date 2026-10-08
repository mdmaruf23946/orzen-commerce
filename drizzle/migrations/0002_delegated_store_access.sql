ALTER TABLE public.store_staff
  ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS store_staff_store_user_uidx
  ON public.store_staff(store_id, user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.store_access_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'viewer',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  access_expires_at timestamptz,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  invited_by_name text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  responded_at timestamptz,
  accepted_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_access_inv_store_idx ON public.store_access_invitations(store_id);
CREATE INDEX IF NOT EXISTS store_access_inv_email_idx ON public.store_access_invitations(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_access_invitations TO authenticated;
GRANT ALL ON public.store_access_invitations TO service_role;
ALTER TABLE public.store_access_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages store invitations" ON public.store_access_invitations
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Invitee reads own invitations" ON public.store_access_invitations
  FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt()->>'email','')));

CREATE OR REPLACE FUNCTION public.has_store_access(_store_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.store_staff
                  WHERE store_id = _store_id AND user_id = auth.uid() AND status = 'active'
                    AND (expires_at IS NULL OR expires_at > now()))
$$;

CREATE OR REPLACE FUNCTION public.is_store_employee(_store_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_staff
     WHERE store_id = _store_id AND user_id = auth.uid() AND status = 'active'
       AND (expires_at IS NULL OR expires_at > now()))
$$;

CREATE OR REPLACE FUNCTION public.staff_can(_store_id uuid, _section text, _level text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.is_store_owner(_store_id) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.store_staff s
      WHERE s.store_id = _store_id AND s.user_id = auth.uid() AND s.status = 'active'
        AND (s.expires_at IS NULL OR s.expires_at > now())
        AND ((_level = 'view' AND coalesce(s.permissions->>_section, 'none') IN ('view','manage'))
          OR (_level = 'manage' AND coalesce(s.permissions->>_section, 'none') = 'manage')))
  END
$$;

CREATE OR REPLACE FUNCTION public.staff_store_id(_user_id uuid)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT store_id FROM public.store_staff
   WHERE user_id = _user_id AND (auth.uid() IS NULL OR _user_id = auth.uid())
     AND status = 'active' AND access_type = 'employee'
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY created_at LIMIT 1
$$;