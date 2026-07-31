ALTER TABLE public.invoice_templates
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS page_size text NOT NULL DEFAULT 'a4';

CREATE TABLE IF NOT EXISTS public.invoice_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.invoice_templates(id) ON DELETE CASCADE,
  canvas jsonb NOT NULL DEFAULT '{}'::jsonb,
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  name text,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_template_versions_template_idx
  ON public.invoice_template_versions(template_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.invoice_template_versions TO authenticated;
GRANT ALL ON public.invoice_template_versions TO service_role;

ALTER TABLE public.invoice_template_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage global template versions" ON public.invoice_template_versions;
CREATE POLICY "Owners manage global template versions"
ON public.invoice_template_versions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.invoice_templates t WHERE t.id = template_id AND t.scope = 'global' AND public.has_role(auth.uid(), 'owner'::app_role)))
WITH CHECK (EXISTS (SELECT 1 FROM public.invoice_templates t WHERE t.id = template_id AND t.scope = 'global' AND public.has_role(auth.uid(), 'owner'::app_role)));

DROP POLICY IF EXISTS "Store owners manage own template versions" ON public.invoice_template_versions;
CREATE POLICY "Store owners manage own template versions"
ON public.invoice_template_versions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.invoice_templates t WHERE t.id = template_id AND t.scope = 'store' AND public.is_store_owner(t.store_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.invoice_templates t WHERE t.id = template_id AND t.scope = 'store' AND public.is_store_owner(t.store_id)));