
CREATE TABLE public.product_import_export_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('import','export')),
  file_name text,
  format text,
  total integer NOT NULL DEFAULT 0,
  imported integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  filters jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.product_import_export_history TO authenticated;
GRANT ALL ON public.product_import_export_history TO service_role;

ALTER TABLE public.product_import_export_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own history"
  ON public.product_import_export_history FOR SELECT
  TO authenticated
  USING (public.is_store_owner(store_id));

CREATE POLICY "Owners can insert own history"
  ON public.product_import_export_history FOR INSERT
  TO authenticated
  WITH CHECK (public.is_store_owner(store_id) AND user_id = auth.uid());

CREATE INDEX idx_pieh_store_created ON public.product_import_export_history (store_id, created_at DESC);
