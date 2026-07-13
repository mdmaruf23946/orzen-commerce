
CREATE TABLE public.store_template (
  id text PRIMARY KEY CHECK (id = 'global'),
  description text,
  primary_color text,
  header_color text,
  title_bar_color text,
  footer_color text,
  button_color text,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  marketing jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery jsonb NOT NULL DEFAULT '{}'::jsonb,
  payments_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  product_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  banners jsonb NOT NULL DEFAULT '[]'::jsonb,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  products jsonb NOT NULL DEFAULT '[]'::jsonb,
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_template TO authenticated;
GRANT ALL ON public.store_template TO service_role;

ALTER TABLE public.store_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template readable by authenticated"
  ON public.store_template FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "template writable by owner role"
  ON public.store_template FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));

CREATE TRIGGER trg_store_template_touch
  BEFORE UPDATE ON public.store_template
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS template_version timestamptz NULL;

INSERT INTO public.store_template (id, primary_color, header_color, title_bar_color, footer_color, button_color, theme)
VALUES ('global', '#0f172a', '#ffffff', '#0f172a', '#0f172a', '#0f172a', '{"radius": 8}'::jsonb)
ON CONFLICT (id) DO NOTHING;
