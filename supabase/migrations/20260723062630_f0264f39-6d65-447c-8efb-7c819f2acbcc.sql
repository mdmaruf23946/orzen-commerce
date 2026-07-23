INSERT INTO public.platform_feature_flags (flag_key, label, description, category, sort_order, enabled)
VALUES ('ai_product_builder', 'AI Product Builder', 'Generate products from images and text using AI', 'ai', 3, true)
ON CONFLICT (flag_key) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, category = EXCLUDED.category;