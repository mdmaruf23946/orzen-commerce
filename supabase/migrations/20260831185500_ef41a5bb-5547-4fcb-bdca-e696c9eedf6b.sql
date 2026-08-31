ALTER TABLE public.subscription_packages ADD COLUMN IF NOT EXISTS landing_page_limit integer NOT NULL DEFAULT 0;

INSERT INTO public.platform_feature_flags (flag_key, label, description, category, sort_order, enabled) VALUES
  ('landing_page_create','Landing Page Builder','Create and edit standalone product landing pages','marketing',42,true),
  ('landing_page_connect','Landing Page Integrations','Connect external landing pages and push orders in','marketing',43,true),
  ('facebook_page','Facebook Page','Facebook Page posts, comments and moderation','marketing',44,true),
  ('whatsapp','WhatsApp Business','WhatsApp Cloud API integration and inbox','communication',45,true),
  ('messenger_inbox','Messenger Inbox','Unified Messenger conversation inbox','communication',46,true),
  ('themes','Store Themes','Theme customization and live preview','storefront',50,true),
  ('custom_pages','Custom Pages','About, policy and content pages','storefront',51,true),
  ('seo','Store SEO','SEO settings and metadata management','marketing',52,true),
  ('duplicate_protection','Duplicate Order Protection','Block repeated/fake orders automatically','ops',53,true),
  ('delivery_zones','Delivery Zones','Zone based delivery charges','ops',54,true),
  ('payment_gateways','Payment Gateways','Store owned payment gateway configuration','finance',55,true),
  ('customer_accounts','Customer Accounts','Storefront customer login and account area','storefront',56,true),
  ('product_reviews','Product Reviews','Collect and moderate product reviews','storefront',57,true),
  ('quick_order','Quick / Manual Orders','Create phone and offline orders from the panel','ops',58,true),
  ('notifications','Notifications','SMS, email and WhatsApp order notifications','communication',59,true),
  ('digital_products','Digital Products','Sell downloadable digital products','products',60,true),
  ('service_products','Service Products','Sell services with workflow management','products',61,true),
  ('subscription_products','Subscription Products','Sell recurring subscription products','products',62,true),
  ('wallet','Wallet & Auto-renewal','Merchant wallet balance and automatic plan renewal','finance',63,true)
ON CONFLICT (flag_key) DO NOTHING;

-- Existing plans keep working: previously ungated areas stay on, and the old
-- landing_pages toggle maps onto both new landing page keys.
UPDATE public.subscription_packages p
SET features = coalesce(p.features,'{}'::jsonb)
  || jsonb_build_object(
      'landing_page_create', coalesce((p.features->>'landing_pages')::boolean, false),
      'landing_page_connect', coalesce((p.features->>'landing_pages')::boolean, false),
      'facebook_page', coalesce((p.features->>'facebook_page')::boolean, false)
     )
  || jsonb_build_object(
      'whatsapp', true, 'messenger_inbox', coalesce((p.features->>'ai_messenger')::boolean, false),
      'themes', true, 'custom_pages', true, 'seo', true,
      'duplicate_protection', true, 'delivery_zones', true, 'payment_gateways', true,
      'customer_accounts', true, 'product_reviews', true, 'quick_order', true,
      'notifications', true, 'digital_products', true, 'service_products', true,
      'subscription_products', true, 'wallet', true
     );