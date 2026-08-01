ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'both';

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_product_type_check;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_product_type_check CHECK (product_type IN ('physical','digital','both'));

ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'general';

ALTER TABLE public.banners
  DROP CONSTRAINT IF EXISTS banners_campaign_type_check;
ALTER TABLE public.banners
  ADD CONSTRAINT banners_campaign_type_check CHECK (campaign_type IN ('physical','digital','general'));

ALTER TABLE public.store_domains
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz,
  ADD COLUMN IF NOT EXISTS disconnect_reason text,
  ADD COLUMN IF NOT EXISTS previous_state jsonb;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS store_mode_changed_at timestamptz;
