ALTER TABLE public.stores ALTER COLUMN merchant_code SET DEFAULT '';
-- The BEFORE INSERT trigger public.tg_store_merchant_code() always replaces the
-- placeholder with the next real code, so '' is never actually stored.