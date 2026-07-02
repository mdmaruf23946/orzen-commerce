
-- Rename legacy "lunex" package to Business and normalize feature matrix + limits across canonical tiers.

UPDATE public.subscription_packages
SET name = 'Business',
    description = COALESCE(NULLIF(description,''), 'For growing brands — unlocks AI, analytics & staff tools.'),
    product_limit = 1000,
    order_limit = 5000,
    storage_mb = 5120,
    staff_limit = 5,
    features = jsonb_build_object(
      'ai_agent', true, 'ai_messenger', true, 'courier', true, 'pixel', true,
      'analytics', true, 'inventory', true, 'invoice', true, 'coupons', true,
      'import_export', true, 'bulk_actions', true, 'staff', true,
      'customer_notes', true, 'returns', true
    ),
    feature_summary = ARRAY[
      'Everything in Basic',
      'AI Sales Agent + Messenger AI',
      'Analytics & Import/Export',
      'Staff, Customer notes & Returns'
    ]
WHERE plan_tier = 'business';

UPDATE public.subscription_packages
SET features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
      'courier', true, 'pixel', true, 'inventory', true, 'invoice', true,
      'coupons', true, 'analytics', true, 'bulk_actions', true,
      'customer_notes', true, 'import_export', true
    ),
    feature_summary = ARRAY[
      'More products & unlimited-feel orders',
      'Courier Integration',
      'Facebook Pixel',
      'Inventory & Invoice'
    ]
WHERE plan_tier = 'basic';

UPDATE public.subscription_packages
SET features = jsonb_build_object('invoice', true),
    feature_summary = ARRAY[
      'Limited products & orders',
      'Basic invoice',
      'No AI / Messenger / Courier / Pixel'
    ]
WHERE plan_tier = 'free';

UPDATE public.subscription_packages
SET features = jsonb_build_object(
      'ai_agent', true, 'ai_messenger', true, 'courier', true, 'pixel', true,
      'analytics', true, 'inventory', true, 'invoice', true, 'coupons', true,
      'import_export', true, 'bulk_actions', true, 'staff', true,
      'customer_notes', true, 'returns', true
    ),
    product_limit = 0, order_limit = 0, storage_mb = 0, staff_limit = 0,
    feature_summary = ARRAY[
      'All features enabled',
      'Unlimited resources',
      'Custom limits & dedicated support'
    ]
WHERE plan_tier = 'custom';
