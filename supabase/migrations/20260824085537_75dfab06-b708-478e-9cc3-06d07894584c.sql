UPDATE public.subscription_packages
SET features = jsonb_set(coalesce(features, '{}'::jsonb), '{facebook_page}', 'true'::jsonb, true)
WHERE lower(name) IN ('basic','business','custom','trial','pro','premium');