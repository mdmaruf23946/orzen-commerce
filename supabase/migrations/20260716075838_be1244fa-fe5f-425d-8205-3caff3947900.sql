
-- Restrict platform_billing_settings reads to owner role
DROP POLICY IF EXISTS "Authenticated can read billing settings" ON public.platform_billing_settings;
CREATE POLICY "Owners can read billing settings"
  ON public.platform_billing_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role));

-- Restrict store_template reads to owner role. Store creation flows will
-- read the template via a SECURITY DEFINER RPC that strips sensitive columns.
DROP POLICY IF EXISTS "template readable by authenticated" ON public.store_template;
CREATE POLICY "Owners can read template"
  ON public.store_template
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role));

-- Definer RPC: returns template safe for seeding new stores (no marketing/payment secrets).
CREATE OR REPLACE FUNCTION public.get_store_template_for_seed()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(t) - 'marketing' - 'payments_config'
    FROM public.store_template t
   WHERE t.id = 'global'
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_store_template_for_seed() FROM public;
GRANT EXECUTE ON FUNCTION public.get_store_template_for_seed() TO authenticated;
