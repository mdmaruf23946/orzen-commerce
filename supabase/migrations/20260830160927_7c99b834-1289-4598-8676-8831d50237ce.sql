ALTER TABLE public.store_themes ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS store_themes_single_default_idx ON public.store_themes (is_default) WHERE is_default;

CREATE OR REPLACE FUNCTION public.tg_store_themes_single_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.store_themes SET is_default = false WHERE id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_themes_single_default ON public.store_themes;
CREATE TRIGGER store_themes_single_default
BEFORE INSERT OR UPDATE OF is_default ON public.store_themes
FOR EACH ROW EXECUTE FUNCTION public.tg_store_themes_single_default();

UPDATE public.store_themes SET is_default = true
WHERE id = (SELECT id FROM public.store_themes WHERE status = 'published' ORDER BY sort_order LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM public.store_themes WHERE is_default);