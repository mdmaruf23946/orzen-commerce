INSERT INTO public.platform_payment_settings (id, bkash, nagad, rocket, sslcommerz, updated_at)
VALUES (
  'global',
  jsonb_build_object(
    'enabled', true,
    'number', '01623239446',
    'merchant_name', 'ORZEN',
    'notification_email', 'mdmaruf0162323@gmail.com',
    'instructions', E'Open your bKash app and choose Send Money.\nSend the exact amount to 01623239446.\nCopy the Transaction ID (TrxID) from the confirmation SMS.\nPaste the TrxID and your sender number below and submit.'
  ),
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
  now()
)
ON CONFLICT (id) DO UPDATE
SET bkash = public.platform_payment_settings.bkash
         || jsonb_build_object(
              'enabled', true,
              'number', '01623239446',
              'notification_email', 'mdmaruf0162323@gmail.com'
            ),
    updated_at = now();