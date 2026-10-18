CREATE OR REPLACE FUNCTION public.consume_ai_credits(_store uuid, _tokens integer, _channel text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tpc integer; cost numeric; bal numeric;
BEGIN
  IF _store IS NULL OR coalesce(_tokens,0) <= 0 THEN RETURN NULL; END IF;
  SELECT tokens_per_credit INTO tpc FROM ai_credit_settings WHERE id;
  tpc := greatest(coalesce(tpc,1000),1);
  cost := round(_tokens::numeric / tpc, 6);
  INSERT INTO store_ai_credits(store_id) VALUES (_store) ON CONFLICT DO NOTHING;
  UPDATE store_ai_credits SET balance = balance - cost, lifetime_used = lifetime_used + cost,
    token_carry = 0, updated_at = now() WHERE store_id=_store RETURNING balance INTO bal;
  INSERT INTO ai_credit_ledger(store_id,delta,kind,channel,tokens,note)
    VALUES (_store,-cost,'usage',_channel,_tokens,_tokens || ' tokens');
  RETURN bal;
END $$;
REVOKE ALL ON FUNCTION public.consume_ai_credits(uuid,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(uuid,integer,text) TO service_role;