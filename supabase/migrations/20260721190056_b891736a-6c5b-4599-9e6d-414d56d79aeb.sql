
UPDATE public.messenger_integrations
   SET human_takeover = false,
       last_error = NULL
 WHERE store_id = '2921e1c4-81d7-467b-b22c-5a0f8bb18883';

UPDATE public.ai_global_settings
   SET default_model = 'google/gemini-2.5-flash'
 WHERE id = 1
   AND (default_model IS NULL OR default_model = 'google/gemini-3-flash-preview');
