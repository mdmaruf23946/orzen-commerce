CREATE POLICY "Service role manages conversational checkout sessions"
ON public.conversational_checkout_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);