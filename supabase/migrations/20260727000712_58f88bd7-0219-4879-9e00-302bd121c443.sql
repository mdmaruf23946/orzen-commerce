
-- Seed the 10 new payment gateway provider rows so they appear in the
-- Winner Admin catalog. Disabled by default; each store admin will only
-- see them once the Winner Admin enables and brands them.
INSERT INTO public.platform_payment_gateways
  (id, label, enabled, sort_order, description, brand_color, secondary_color, icon_bg_color)
VALUES
  ('bkash_merchant', 'bKash Merchant', false, 210,
   'Direct bKash merchant checkout. Payments settle straight to your bKash merchant account.',
   '#E2136E', '#FFE1EE', '#FFE1EE'),
  ('nagad_merchant', 'Nagad Merchant', false, 220,
   'Direct Nagad merchant checkout with RSA-signed transactions.',
   '#EB1C24', '#FEE2E2', '#FEE2E2'),
  ('upay_merchant', 'Upay Merchant', false, 230,
   'Direct Upay merchant checkout for UCB-powered payments.',
   '#7C3AED', '#EDE9FE', '#EDE9FE'),
  ('bdgate', 'BDGate', false, 300,
   'Unified Bangladesh aggregator covering cards, MFS, and internet banking.',
   '#0EA5E9', '#E0F2FE', '#E0F2FE'),
  ('nagorikpay', 'NagorikPay', false, 310,
   'Aggregator for MFS and card payments across Bangladesh.',
   '#16A34A', '#DCFCE7', '#DCFCE7'),
  ('paybybd', 'PaybyBD', false, 320,
   'Multi-method payment aggregator for Bangladeshi merchants.',
   '#F59E0B', '#FEF3C7', '#FEF3C7'),
  ('fastaar', 'Fastaar', false, 330,
   'Fast-settlement aggregator covering cards, MFS, and bank transfers.',
   '#EF4444', '#FEE2E2', '#FEE2E2'),
  ('paybd', 'PayBD', false, 340,
   'Bangladesh payment aggregator with unified checkout.',
   '#2563EB', '#DBEAFE', '#DBEAFE'),
  ('ipaybd', 'iPayBD', false, 350,
   'Aggregator supporting MFS, cards, and internet banking.',
   '#0891B2', '#CFFAFE', '#CFFAFE'),
  ('urbdpay', 'UrbdPay', false, 360,
   'Bangladesh aggregator for cards and mobile financial services.',
   '#DB2777', '#FCE7F3', '#FCE7F3')
ON CONFLICT (id) DO NOTHING;
