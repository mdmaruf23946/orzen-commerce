
CREATE TABLE public.role_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_email text,
  target_user_id uuid not null,
  target_email text,
  role public.app_role not null,
  action text not null check (action in ('granted','revoked')),
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.role_audit_log TO authenticated;
GRANT ALL ON public.role_audit_log TO service_role;

ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view role audit log"
ON public.role_audit_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert role audit log"
ON public.role_audit_log FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner') AND actor_user_id = auth.uid());
