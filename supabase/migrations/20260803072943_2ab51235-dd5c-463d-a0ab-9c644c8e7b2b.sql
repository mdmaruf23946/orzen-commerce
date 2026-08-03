DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'products'
     AND column_name <> 'cost_price';

  EXECUTE 'REVOKE SELECT ON public.products FROM anon';
  EXECUTE format('GRANT SELECT (%s) ON public.products TO anon', cols);
END $$;