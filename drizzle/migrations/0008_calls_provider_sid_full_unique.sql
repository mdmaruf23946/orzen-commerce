DROP INDEX IF EXISTS public.calls_provider_sid_idx;
CREATE UNIQUE INDEX calls_provider_sid_idx ON public.calls (provider_call_sid);