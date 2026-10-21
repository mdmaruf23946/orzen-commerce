CREATE TABLE public.global_phrase_patterns (
  phrase_key text NOT NULL CHECK (char_length(phrase_key) BETWEEN 3 AND 40),
  intent text NOT NULL CHECK (intent IN ('catalog_browse','delivery_charge')),
  store_hashes text[] NOT NULL DEFAULT '{}',
  hits integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phrase_key, intent)
);
GRANT ALL ON public.global_phrase_patterns TO service_role;
ALTER TABLE public.global_phrase_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read phrasebook" ON public.global_phrase_patterns FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
GRANT SELECT ON public.global_phrase_patterns TO authenticated;

CREATE OR REPLACE FUNCTION public.learn_global_phrase(p_key text, p_intent text, p_store text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.global_phrase_patterns (phrase_key, intent, store_hashes, hits)
  VALUES (p_key, p_intent, ARRAY[p_store], 1)
  ON CONFLICT (phrase_key, intent) DO UPDATE SET
    hits = global_phrase_patterns.hits + 1,
    store_hashes = CASE WHEN p_store = ANY(global_phrase_patterns.store_hashes) OR cardinality(global_phrase_patterns.store_hashes) >= 50
      THEN global_phrase_patterns.store_hashes ELSE global_phrase_patterns.store_hashes || p_store END,
    updated_at = now();
$$;

CREATE OR REPLACE FUNCTION public.global_phrase_stats()
RETURNS TABLE(phrase_key text, intent text, stores integer, hits integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT phrase_key, intent, cardinality(store_hashes), hits FROM public.global_phrase_patterns
  WHERE phrase_key IN (SELECT phrase_key FROM public.global_phrase_patterns GROUP BY phrase_key HAVING max(cardinality(store_hashes)) >= 3)
  LIMIT 20000;
$$;

REVOKE ALL ON FUNCTION public.learn_global_phrase(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.global_phrase_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learn_global_phrase(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.global_phrase_stats() TO service_role;