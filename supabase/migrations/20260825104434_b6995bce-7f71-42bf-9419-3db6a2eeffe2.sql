CREATE TABLE public.platform_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  store_name text NOT NULL DEFAULT '',
  avatar_url text,
  rating int NOT NULL DEFAULT 5,
  review text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT '#0ea5e9',
  is_visible boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_reviews TO authenticated;
GRANT ALL ON public.platform_reviews TO service_role;

ALTER TABLE public.platform_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read visible reviews"
  ON public.platform_reviews FOR SELECT
  USING (is_visible = true);

CREATE POLICY "Owners manage reviews"
  ON public.platform_reviews FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER trg_platform_reviews_updated_at
  BEFORE UPDATE ON public.platform_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_reviews (name, store_name, rating, review, tone, sort_order) VALUES
  ('Nusrat Jahan', 'Deshi Basket', 5, 'Setup took a Sunday afternoon. Courier booking with Pathao inside ORZEN saved us 4 hours a day.', '#16a34a', 1),
  ('Rahim Uddin', 'Rahim Fashion', 5, 'Fraud check before shipping cut our return rate by half. The dashboard is dead simple.', '#7c3aed', 2),
  ('Sadia Islam', 'Glow Care BD', 5, 'The AI sales agent replies to Messenger at 2am. We wake up to confirmed orders.', '#ea580c', 3),
  ('Tanvir Ahmed', 'Voltronics', 5, 'Inventory, invoices, analytics — one login. I stopped juggling five tabs.', '#0ea5e9', 4),
  ('Mahi Chowdhury', 'Foodly', 5, 'Messenger AI confirms orders overnight. Morning routine: just print labels.', '#dc2626', 5),
  ('Arif Hossain', 'Gadget Hub BD', 5, 'Landing pages plus COD confirmation calls doubled our conversion in a month.', '#0f766e', 6);