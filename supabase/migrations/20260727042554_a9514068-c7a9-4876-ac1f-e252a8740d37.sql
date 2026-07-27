
ALTER TABLE public.platform_payment_gateways
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS docs_url text;

UPDATE public.platform_payment_gateways SET
  website_url = COALESCE(website_url, CASE id
    WHEN 'sslcommerz' THEN 'https://www.sslcommerz.com'
    WHEN 'shurjopay' THEN 'https://shurjopay.com.bd'
    WHEN 'amarpay' THEN 'https://aamarpay.com'
    WHEN 'portwallet' THEN 'https://portwallet.com'
    WHEN 'stripe' THEN 'https://stripe.com'
    WHEN 'paypal' THEN 'https://www.paypal.com'
    WHEN 'bkash' THEN 'https://www.bkash.com'
    WHEN 'bkash_merchant' THEN 'https://www.bkash.com'
    WHEN 'nagad_merchant' THEN 'https://nagad.com.bd'
    WHEN 'upay_merchant' THEN 'https://upaybd.com'
    WHEN 'bdgate' THEN 'https://bdgate.io'
    WHEN 'nagorikpay' THEN 'https://nagorikpay.com'
    WHEN 'paybybd' THEN 'https://paybybd.com'
    WHEN 'fastaar' THEN 'https://fastaar.com'
    WHEN 'paybd' THEN 'https://paybd.net'
    WHEN 'ipaybd' THEN 'https://ipaybd.com'
    WHEN 'urbdpay' THEN 'https://urbdpay.com'
    ELSE NULL END),
  docs_url = COALESCE(docs_url, CASE id
    WHEN 'sslcommerz' THEN 'https://developer.sslcommerz.com/'
    WHEN 'shurjopay' THEN 'https://engine.shurjopayment.com/'
    WHEN 'amarpay' THEN 'https://aamarpay.readme.io/'
    WHEN 'portwallet' THEN 'https://docs.portwallet.com/'
    WHEN 'stripe' THEN 'https://stripe.com/docs'
    WHEN 'paypal' THEN 'https://developer.paypal.com/'
    WHEN 'bkash' THEN 'https://developer.bka.sh/'
    WHEN 'bkash_merchant' THEN 'https://developer.bka.sh/'
    ELSE NULL END);
