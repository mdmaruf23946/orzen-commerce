-- One-time correction: recompute totals for previously stored fraud_checks that
-- accidentally counted BD Courier's nested "summary" bucket as a courier.
UPDATE public.fraud_checks fc
SET
  total_orders = COALESCE((fc.raw->'courierData'->'summary'->>'total_parcel')::int, fc.total_orders),
  successful   = COALESCE((fc.raw->'courierData'->'summary'->>'success_parcel')::int, fc.successful),
  cancelled    = COALESCE((fc.raw->'courierData'->'summary'->>'cancelled_parcel')::int, fc.cancelled),
  returned     = GREATEST(
                   COALESCE((fc.raw->'courierData'->'summary'->>'total_parcel')::int, 0)
                   - COALESCE((fc.raw->'courierData'->'summary'->>'success_parcel')::int, 0)
                   - COALESCE((fc.raw->'courierData'->'summary'->>'cancelled_parcel')::int, 0),
                   0),
  cod_success_rate = CASE
    WHEN COALESCE((fc.raw->'courierData'->'summary'->>'total_parcel')::numeric, 0) > 0
      THEN ROUND(
        (COALESCE((fc.raw->'courierData'->'summary'->>'success_parcel')::numeric, 0)
         / (fc.raw->'courierData'->'summary'->>'total_parcel')::numeric) * 1000
      ) / 10
    ELSE fc.cod_success_rate
  END,
  courier_history = COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'courier', k,
      'total',     COALESCE((v->>'total_parcel')::int, 0),
      'success',   COALESCE((v->>'success_parcel')::int, 0),
      'cancelled', COALESCE((v->>'cancelled_parcel')::int, 0),
      'rate', CASE WHEN COALESCE((v->>'total_parcel')::numeric, 0) > 0
                   THEN ROUND((COALESCE((v->>'success_parcel')::numeric, 0)
                        / (v->>'total_parcel')::numeric) * 100)
                   ELSE 0 END
    ))
    FROM jsonb_each(fc.raw->'courierData') AS e(k, v)
    WHERE k <> 'summary'
  ), fc.courier_history)
WHERE fc.raw->'courierData'->'summary' IS NOT NULL;