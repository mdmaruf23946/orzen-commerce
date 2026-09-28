ALTER TABLE public.product_image_embeddings ADD COLUMN IF NOT EXISTS phash text;
ALTER TABLE public.product_image_embeddings ADD COLUMN IF NOT EXISTS embedded_url text;
UPDATE public.product_image_embeddings SET embedding = NULL WHERE embedding IS NOT NULL;
ALTER TABLE public.product_image_embeddings ALTER COLUMN embedding TYPE extensions.vector(768);
CREATE INDEX IF NOT EXISTS product_image_embeddings_hnsw ON public.product_image_embeddings USING hnsw (embedding extensions.vector_cosine_ops);
CREATE OR REPLACE FUNCTION public.match_product_image_embeddings(_store_id uuid, _embedding text, _limit integer DEFAULT 5)
 RETURNS TABLE(product_id uuid, similarity double precision) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','extensions'
AS $f$
  SELECT e.product_id, 1 - (e.embedding <=> _embedding::extensions.vector) AS similarity
  FROM public.product_image_embeddings e
  WHERE e.store_id = _store_id AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> _embedding::extensions.vector
  LIMIT LEAST(GREATEST(_limit, 1), 20);
$f$;
REVOKE EXECUTE ON FUNCTION public.match_product_image_embeddings(uuid,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_product_image_embeddings(uuid,text,integer) TO service_role;