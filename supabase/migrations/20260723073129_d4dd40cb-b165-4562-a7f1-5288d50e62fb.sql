ALTER TABLE public.products ALTER COLUMN total_sold SET DEFAULT 0;
UPDATE public.products SET total_sold = 0 WHERE total_sold IS NULL;