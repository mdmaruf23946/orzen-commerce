DROP TABLE IF EXISTS public.download_events CASCADE;
DROP TABLE IF EXISTS public.order_downloads CASCADE;
DROP TABLE IF EXISTS public.license_keys CASCADE;
DROP TABLE IF EXISTS public.product_bundle_items CASCADE;
DROP TABLE IF EXISTS public.product_files CASCADE;
DROP TABLE IF EXISTS public.store_digital_category_prefs CASCADE;
DROP TABLE IF EXISTS public.platform_digital_categories CASCADE;
DROP TABLE IF EXISTS public.platform_digital_settings CASCADE;

ALTER TABLE public.stores DROP COLUMN IF EXISTS store_mode;
ALTER TABLE public.products DROP COLUMN IF EXISTS digital;
ALTER TABLE public.products DROP COLUMN IF EXISTS digital_category;
ALTER TABLE public.orders DROP COLUMN IF EXISTS is_digital;

DROP FUNCTION IF EXISTS public.get_digital_public_settings();