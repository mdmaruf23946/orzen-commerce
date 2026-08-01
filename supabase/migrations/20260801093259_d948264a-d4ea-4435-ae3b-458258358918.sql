-- 1. Global digital category catalog (Winner Admin owned)
CREATE TABLE public.platform_digital_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_digital_categories TO anon;
GRANT SELECT ON public.platform_digital_categories TO authenticated;
GRANT ALL ON public.platform_digital_categories TO service_role;
ALTER TABLE public.platform_digital_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "digital categories public read"
  ON public.platform_digital_categories FOR SELECT
  USING (is_active = true);
CREATE POLICY "platform owners manage digital categories"
  ON public.platform_digital_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER platform_digital_categories_touch BEFORE UPDATE
  ON public.platform_digital_categories FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 2. Per-store overrides (hide / rename a global category)
CREATE TABLE public.store_digital_category_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_key text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  custom_name text,
  sort_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, category_key)
);
GRANT SELECT ON public.store_digital_category_prefs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_digital_category_prefs TO authenticated;
GRANT ALL ON public.store_digital_category_prefs TO service_role;
ALTER TABLE public.store_digital_category_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "category prefs public read"
  ON public.store_digital_category_prefs FOR SELECT
  USING (public.is_store_active(store_id));
CREATE POLICY "owner manages category prefs"
  ON public.store_digital_category_prefs FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER store_digital_category_prefs_touch BEFORE UPDATE
  ON public.store_digital_category_prefs FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 3. Bundle contents
CREATE TABLE public.product_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bundle_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  child_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bundle_product_id, child_product_id)
);
GRANT SELECT ON public.product_bundle_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_bundle_items TO authenticated;
GRANT ALL ON public.product_bundle_items TO service_role;
ALTER TABLE public.product_bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundle items public read"
  ON public.product_bundle_items FOR SELECT
  USING (public.is_store_active(store_id));
CREATE POLICY "owner manages bundle items"
  ON public.product_bundle_items FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER product_bundle_items_touch BEFORE UPDATE
  ON public.product_bundle_items FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 4. Download history / device tracking
CREATE TABLE public.download_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  download_id uuid REFERENCES public.order_downloads(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.store_customers(id) ON DELETE SET NULL,
  device_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX download_events_download_idx ON public.download_events(download_id);
CREATE INDEX download_events_store_idx ON public.download_events(store_id, created_at DESC);
GRANT SELECT ON public.download_events TO authenticated;
GRANT ALL ON public.download_events TO service_role;
ALTER TABLE public.download_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads download events"
  ON public.download_events FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

-- 5. Global digital category on products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS digital_category text;
GRANT SELECT (digital_category) ON public.products TO anon;

-- 6. Seed the default catalog
INSERT INTO public.platform_digital_categories (key, name, icon, description, sort_order) VALUES
  ('ebooks', 'eBooks', 'BookOpen', 'Digital books, guides and publications', 10),
  ('courses', 'Courses', 'GraduationCap', 'Online courses and training material', 20),
  ('templates', 'Templates', 'LayoutTemplate', 'Ready-made design and document templates', 30),
  ('source-code', 'Source Code', 'Code2', 'Scripts, snippets and full codebases', 40),
  ('website-templates', 'Website Templates', 'Globe', 'HTML, WordPress and landing page themes', 50),
  ('ui-kits', 'UI Kits', 'Component', 'Design systems and interface kits', 60),
  ('graphics', 'Graphics', 'Image', 'Illustrations, mockups and vectors', 70),
  ('fonts', 'Fonts', 'Type', 'Typefaces and lettering', 80),
  ('icons', 'Icons', 'Shapes', 'Icon sets and pictograms', 90),
  ('plugins', 'Plugins', 'Puzzle', 'Extensions, add-ons and modules', 100),
  ('software', 'Software', 'MonitorSmartphone', 'Desktop and web applications', 110),
  ('mobile-apps', 'Mobile Apps', 'Smartphone', 'Android and iOS app packages', 120),
  ('audio', 'Audio', 'Music', 'Music, loops and sound effects', 130),
  ('video', 'Video', 'Video', 'Footage, motion graphics and presets', 140),
  ('photography', 'Photography', 'Camera', 'Stock photos and photo packs', 150),
  ('documents', 'Documents', 'FileText', 'Forms, contracts and printables', 160),
  ('business-resources', 'Business Resources', 'Briefcase', 'Plans, spreadsheets and toolkits', 170)
ON CONFLICT (key) DO NOTHING;