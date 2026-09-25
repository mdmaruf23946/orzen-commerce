CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.product_image_embeddings (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  embedding extensions.vector(3072),
  model text NOT NULL DEFAULT 'google/gemini-embedding-2',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_image_embeddings_store_idx ON public.product_image_embeddings(store_id);

GRANT ALL ON public.product_image_embeddings TO service_role;
ALTER TABLE public.product_image_embeddings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.match_product_image_embeddings(_store_id uuid, _embedding text, _limit int DEFAULT 5)
RETURNS TABLE(product_id uuid, similarity double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
  SELECT e.product_id, 1 - (e.embedding <=> _embedding::extensions.vector) AS similarity
  FROM public.product_image_embeddings e
  WHERE e.store_id = _store_id AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> _embedding::extensions.vector
  LIMIT LEAST(GREATEST(_limit, 1), 20);
$$;
REVOKE ALL ON FUNCTION public.match_product_image_embeddings(uuid, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_product_image_embeddings(uuid, text, int) TO service_role;