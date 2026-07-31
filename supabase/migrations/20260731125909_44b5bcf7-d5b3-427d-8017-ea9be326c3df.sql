-- 1. Theme catalog
CREATE TABLE public.store_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'modern',
  description text,
  preview_url text,
  status text NOT NULL DEFAULT 'draft',
  sort_order integer NOT NULL DEFAULT 0,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_themes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_themes TO authenticated;
GRANT ALL ON public.store_themes TO service_role;

ALTER TABLE public.store_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_themes public read published"
  ON public.store_themes FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "store_themes owner insert"
  ON public.store_themes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "store_themes owner update"
  ON public.store_themes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "store_themes owner delete"
  ON public.store_themes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE OR REPLACE FUNCTION public.tg_store_themes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_store_themes_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER store_themes_updated_at
  BEFORE UPDATE ON public.store_themes
  FOR EACH ROW EXECUTE FUNCTION public.tg_store_themes_updated_at();

-- 2. Store selection + safe overrides
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.store_themes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS theme_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS theme_draft jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Seed themes
INSERT INTO public.store_themes (name, slug, category, description, status, sort_order, definition, locked) VALUES
('Modern Blue','modern-blue','modern','Clean, bright and conversion focused.','published',10,
 '{"colors":{"primary":"#2563EB","secondary":"#1F2937","accent":"#F59E0B","button":"#2563EB","header":"#FFFFFF","footer":"#111827"},"typography":{"heading_font":"Inter","body_font":"Inter","button_font":"Inter","base_size":16},"header":{"search":true,"categories":true,"wishlist":true,"cart":true,"account":true},"sections":{"banner":true,"categories":true,"featured":true,"flash_sale":true,"best_sellers":true,"new_arrival":true,"reviews":true,"faq":true},"product_card":{"rating":true,"discount_badge":true,"sold_count":true,"wishlist":true,"quick_view":true,"buy_now":true,"add_to_cart":true},"buttons":{"radius":8,"style":"solid","hover_color":"#1D4ED8"},"banner":{"style":"slider"},"animation":"fade"}'::jsonb,'{}'::jsonb),
('Premium Corporate','premium-corporate','corporate','Structured layout for B2B and service brands.','published',20,
 '{"colors":{"primary":"#0F172A","secondary":"#334155","accent":"#0EA5E9","button":"#0F172A","header":"#FFFFFF","footer":"#0F172A"},"typography":{"heading_font":"Manrope","body_font":"Inter","button_font":"Manrope","base_size":16},"header":{"search":true,"categories":true,"wishlist":false,"cart":true,"account":true},"sections":{"banner":true,"categories":true,"featured":true,"flash_sale":false,"best_sellers":true,"new_arrival":true,"reviews":true,"faq":true},"product_card":{"rating":true,"discount_badge":true,"sold_count":false,"wishlist":false,"quick_view":true,"buy_now":true,"add_to_cart":true},"buttons":{"radius":4,"style":"solid","hover_color":"#1E293B"},"banner":{"style":"static"},"animation":"slide"}'::jsonb,'{}'::jsonb),
('Luxury Gold','luxury-gold','luxury','Dark, editorial and premium.','published',30,
 '{"colors":{"primary":"#C9A84C","secondary":"#0D0D0D","accent":"#F0D78C","button":"#C9A84C","header":"#0D0D0D","footer":"#0D0D0D"},"typography":{"heading_font":"Cormorant Garamond","body_font":"Karla","button_font":"Karla","base_size":16},"header":{"search":true,"categories":true,"wishlist":true,"cart":true,"account":true},"sections":{"banner":true,"categories":true,"featured":true,"flash_sale":false,"best_sellers":true,"new_arrival":true,"reviews":true,"faq":false},"product_card":{"rating":true,"discount_badge":false,"sold_count":false,"wishlist":true,"quick_view":true,"buy_now":true,"add_to_cart":true},"buttons":{"radius":0,"style":"outline","hover_color":"#F0D78C"},"banner":{"style":"full"},"animation":"fade"}'::jsonb,'{"colors":["header","footer"]}'::jsonb),
('Fashion Store','fashion-store','fashion','Bold imagery and lookbook feel.','published',40,
 '{"colors":{"primary":"#EC4899","secondary":"#111827","accent":"#F472B6","button":"#EC4899","header":"#FFFFFF","footer":"#111827"},"typography":{"heading_font":"Syne","body_font":"Plus Jakarta Sans","button_font":"Plus Jakarta Sans","base_size":16},"header":{"search":true,"categories":true,"wishlist":true,"cart":true,"account":true},"sections":{"banner":true,"categories":true,"featured":true,"flash_sale":true,"best_sellers":true,"new_arrival":true,"reviews":true,"faq":false},"product_card":{"rating":true,"discount_badge":true,"sold_count":true,"wishlist":true,"quick_view":true,"buy_now":true,"add_to_cart":true},"buttons":{"radius":24,"style":"solid","hover_color":"#DB2777"},"banner":{"style":"slider"},"animation":"zoom"}'::jsonb,'{}'::jsonb),
('Electronics Pro','electronics-pro','electronics','Dense catalog layout for gadgets.','published',50,
 '{"colors":{"primary":"#1D4ED8","secondary":"#0F172A","accent":"#F97316","button":"#F97316","header":"#FFFFFF","footer":"#0F172A"},"typography":{"heading_font":"Space Grotesk","body_font":"DM Sans","button_font":"DM Sans","base_size":15},"header":{"search":true,"categories":true,"wishlist":true,"cart":true,"account":true},"sections":{"banner":true,"categories":true,"featured":true,"flash_sale":true,"best_sellers":true,"new_arrival":true,"reviews":true,"faq":true},"product_card":{"rating":true,"discount_badge":true,"sold_count":true,"wishlist":true,"quick_view":true,"buy_now":true,"add_to_cart":true},"buttons":{"radius":6,"style":"solid","hover_color":"#EA580C"},"banner":{"style":"slider"},"animation":"slide"}'::jsonb,'{}'::jsonb),
('Grocery Fresh','grocery-fresh','grocery','Friendly green layout for daily essentials.','published',60,
 '{"colors":{"primary":"#16A34A","secondary":"#14532D","accent":"#FACC15","button":"#16A34A","header":"#FFFFFF","footer":"#14532D"},"typography":{"heading_font":"Figtree","body_font":"Figtree","button_font":"Figtree","base_size":16},"header":{"search":true,"categories":true,"wishlist":false,"cart":true,"account":true},"sections":{"banner":true,"categories":true,"featured":true,"flash_sale":true,"best_sellers":true,"new_arrival":false,"reviews":true,"faq":true},"product_card":{"rating":true,"discount_badge":true,"sold_count":true,"wishlist":false,"quick_view":false,"buy_now":true,"add_to_cart":true},"buttons":{"radius":12,"style":"solid","hover_color":"#15803D"},"banner":{"style":"static"},"animation":"none"}'::jsonb,'{}'::jsonb),
('Minimal Mono','minimal-mono','minimal','Whitespace-first, typography led.','published',70,
 '{"colors":{"primary":"#111111","secondary":"#555555","accent":"#111111","button":"#111111","header":"#FFFFFF","footer":"#F5F3EE"},"typography":{"heading_font":"Work Sans","body_font":"Work Sans","button_font":"Work Sans","base_size":16},"header":{"search":true,"categories":false,"wishlist":false,"cart":true,"account":true},"sections":{"banner":true,"categories":false,"featured":true,"flash_sale":false,"best_sellers":true,"new_arrival":true,"reviews":false,"faq":false},"product_card":{"rating":false,"discount_badge":true,"sold_count":false,"wishlist":false,"quick_view":false,"buy_now":false,"add_to_cart":true},"buttons":{"radius":0,"style":"outline","hover_color":"#333333"},"banner":{"style":"static"},"animation":"fade"}'::jsonb,'{"sections":["banner"]}'::jsonb),
('Dark Pro','dark-pro','dark','High contrast dark storefront.','published',80,
 '{"colors":{"primary":"#22D3EE","secondary":"#0B1120","accent":"#A78BFA","button":"#22D3EE","header":"#0B1120","footer":"#0B1120"},"typography":{"heading_font":"Sora","body_font":"Manrope","button_font":"Manrope","base_size":16},"header":{"search":true,"categories":true,"wishlist":true,"cart":true,"account":true},"sections":{"banner":true,"categories":true,"featured":true,"flash_sale":true,"best_sellers":true,"new_arrival":true,"reviews":true,"faq":true},"product_card":{"rating":true,"discount_badge":true,"sold_count":true,"wishlist":true,"quick_view":true,"buy_now":true,"add_to_cart":true},"buttons":{"radius":10,"style":"soft","hover_color":"#06B6D4"},"banner":{"style":"full"},"animation":"zoom"}'::jsonb,'{"colors":["header","footer"]}'::jsonb),
('Elegant Rose','elegant-rose','elegant','Soft, refined and feminine.','published',90,
 '{"colors":{"primary":"#9B72CF","secondary":"#4C1D95","accent":"#E8C5D0","button":"#9B72CF","header":"#FFFFFF","footer":"#2E1065"},"typography":{"heading_font":"Lora","body_font":"Nunito Sans","button_font":"Nunito Sans","base_size":16},"header":{"search":true,"categories":true,"wishlist":true,"cart":true,"account":true},"sections":{"banner":true,"categories":true,"featured":true,"flash_sale":false,"best_sellers":true,"new_arrival":true,"reviews":true,"faq":true},"product_card":{"rating":true,"discount_badge":true,"sold_count":false,"wishlist":true,"quick_view":true,"buy_now":true,"add_to_cart":true},"buttons":{"radius":20,"style":"soft","hover_color":"#7E22CE"},"banner":{"style":"slider"},"animation":"fade"}'::jsonb,'{}'::jsonb),
('Corporate Clean','corporate-clean','corporate','Neutral, trustworthy and simple.','published',100,
 '{"colors":{"primary":"#3B82F6","secondary":"#475569","accent":"#22C55E","button":"#3B82F6","header":"#FFFFFF","footer":"#1E293B"},"typography":{"heading_font":"Inter","body_font":"Inter","button_font":"Inter","base_size":16},"header":{"search":true,"categories":true,"wishlist":false,"cart":true,"account":true},"sections":{"banner":true,"categories":true,"featured":true,"flash_sale":false,"best_sellers":true,"new_arrival":true,"reviews":true,"faq":true},"product_card":{"rating":true,"discount_badge":true,"sold_count":false,"wishlist":false,"quick_view":true,"buy_now":true,"add_to_cart":true},"buttons":{"radius":8,"style":"solid","hover_color":"#2563EB"},"banner":{"style":"static"},"animation":"none"}'::jsonb,'{}'::jsonb),
('Beauty Soft','beauty-soft','premium','Pastel, calm and skincare ready.','published',110,
 '{"colors":{"primary":"#C17C74","secondary":"#8B6F5E","accent":"#F8E8EE","button":"#C17C74","header":"#FFFFFF","footer":"#8B6F5E"},"typography":{"heading_font":"Urbanist","body_font":"Epilogue","button_font":"Epilogue","base_size":16},"header":{"search":true,"categories":true,"wishlist":true,"cart":true,"account":true},"sections":{"banner":true,"categories":true,"featured":true,"flash_sale":true,"best_sellers":true,"new_arrival":true,"reviews":true,"faq":false},"product_card":{"rating":true,"discount_badge":true,"sold_count":true,"wishlist":true,"quick_view":true,"buy_now":true,"add_to_cart":true},"buttons":{"radius":16,"style":"soft","hover_color":"#A45B54"},"banner":{"style":"slider"},"animation":"fade"}'::jsonb,'{}'::jsonb),
('Sports Bold','sports-bold','modern','Loud, energetic and promo driven.','published',120,
 '{"colors":{"primary":"#E85D3A","secondary":"#1A1A1A","accent":"#FFEB3B","button":"#E85D3A","header":"#1A1A1A","footer":"#1A1A1A"},"typography":{"heading_font":"Bebas Neue","body_font":"Barlow","button_font":"Barlow","base_size":16},"header":{"search":true,"categories":true,"wishlist":true,"cart":true,"account":true},"sections":{"banner":true,"categories":true,"featured":true,"flash_sale":true,"best_sellers":true,"new_arrival":true,"reviews":true,"faq":false},"product_card":{"rating":true,"discount_badge":true,"sold_count":true,"wishlist":true,"quick_view":false,"buy_now":true,"add_to_cart":true},"buttons":{"radius":2,"style":"solid","hover_color":"#C2410C"},"banner":{"style":"full"},"animation":"slide"}'::jsonb,'{"colors":["header"]}'::jsonb);