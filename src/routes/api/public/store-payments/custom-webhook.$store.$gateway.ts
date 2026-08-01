// Public webhook receiver for Custom Payment Gateways.
// URL: /api/public/store-payments/custom-webhook/:store/:gateway
// - Verifies configured signature (HMAC / shared secret) using stored credentials.
// - Persists each delivery for owner inspection with dedup on event_id.
// - Attempts to normalise the provider status against the configured map.
import { createFileRoute } from "@tanstack/react-router";

function headersToObject(req: Request) {
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (["authorization", "cookie", "x-api-key", "x-api-secret"].includes(lk)) return;
    out[k] = v.length > 500 ? v.slice(0, 500) + "…" : v;
  });
  return out;
}

function safeSummary(v: unknown): unknown {
  try {
    const s = JSON.stringify(v);
    return s.length > 8000 ? JSON.parse(s.slice(0, 8000) + "\"") : v;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/store-payments/custom-webhook/$store/$gateway")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { store: storeId, gateway: gatewayId } = params;
        const source = new URL(request.url).searchParams.get("source") === "test" ? "test" : "live";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let processingStatus: "received" | "processed" | "invalid_signature" | "error" | "duplicate" = "received";
        let errorMessage: string | null = null;
        let signatureValid: boolean | null = null;
        let normalized: string | null = null;
        let providerRef: string | null = null;
        let eventId: string | null = null;
        let eventType: string | null = null;
        let payload: unknown = null;
        let statusCode = 200;

        const rawBody = await request.text();
        try {
          payload = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          payload = { _raw: rawBody.slice(0, 2000) };
        }

        try {
          const { data: gw, error } = await supabaseAdmin
            .from("custom_payment_gateways")
            .select("*")
            .eq("id", gatewayId)
            .eq("store_id", storeId)
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!gw) throw new Error("Gateway not found");

          let creds: Record<string, string> = {};
          if ((gw as any).credentials_ciphertext) {
            try {
              const { decryptJSON } = await import("@/lib/crypto/credentials.server");
              creds = decryptJSON<Record<string, string>>((gw as any).credentials_ciphertext);
            } catch {
              /* proceed without */
            }
          }

          const { verifyWebhookSignature, readPath, normalizeStatus } = await import(
            "@/lib/custom-gateway/engine.server"
          );
          const cfg = (gw as any).config;
          signatureValid = verifyWebhookSignature(cfg, rawBody, request.headers, creds);
          if (signatureValid === false && source === "live") {
            processingStatus = "invalid_signature";
            statusCode = 401;
            errorMessage = "Signature verification failed";
          } else {
            eventId = (readPath(payload, cfg.webhook.eventIdPath) as string | undefined) ?? null;
            eventType = (readPath(payload, cfg.webhook.eventTypePath) as string | undefined) ?? null;
            providerRef = (readPath(payload, cfg.webhook.providerRefPath) as string | undefined) ?? null;
            const rawStatus = readPath(payload, cfg.webhook.statusPath) as string | undefined;
            normalized = normalizeStatus(rawStatus, cfg.statusMap) ?? (rawStatus ?? null);

            if (eventId) {
              // Best-effort idempotency
              const { data: existing } = await supabaseAdmin
                .from("custom_payment_gateway_events")
                .select("id")
                .eq("gateway_id", gatewayId)
                .eq("event_id", eventId)
                .maybeSingle();
              if (existing) {
                processingStatus = "duplicate";
              } else {
                processingStatus = "processed";
              }
            } else {
              processingStatus = "processed";
            }

            // Reconcile the matching order when the provider reports success.
            // Test deliveries are logged only — they must never move money state.
            const claimsPaid = ["paid", "success", "completed", "succeeded"].includes(
              String(normalized).toLowerCase(),
            );
            if (processingStatus === "processed" && providerRef && claimsPaid && source === "live") {
              // Unsigned webhooks are unauthenticated by definition: confirm
              // with the provider's own verification endpoint before we mark
              // an order paid, otherwise anyone could forge this callback.
              let trusted = signatureValid === true;
              if (!trusted) {
                try {
                  const { executeVerification } = await import("@/lib/custom-gateway/engine.server");
                  const v = await executeVerification(
                    { ...(gw as any), config: cfg } as any,
                    creds,
                    {
                      order_id: providerRef,
                      amount: 0,
                      currency: (gw as any).currency ?? "BDT",
                      customer_name: "",
                      customer_email: "",
                      customer_phone: "",
                      product_name: "",
                      product_quantity: 1,
                      shipping_address: "",
                      success_url: "",
                      cancel_url: "",
                      fail_url: "",
                      callback_url: "",
                      webhook_url: "",
                      store_id: storeId,
                      transaction_id: providerRef,
                    } as any,
                  );
                  trusted = v.status === "paid";
                  if (!trusted) errorMessage = v.error ?? "Provider verification did not confirm payment";
                } catch (e: unknown) {
                  errorMessage = e instanceof Error ? e.message : String(e);
                }
              }

              if (!trusted) {
                processingStatus = "invalid_signature";
                statusCode = 401;
                errorMessage = errorMessage ?? "Unverified payment callback rejected";
              } else {
                const { data: st } = await supabaseAdmin
                  .from("stores")
                  .select("payments_config")
                  .eq("id", storeId)
                  .maybeSingle();
                const rules: any = ((st as any)?.payments_config ?? {}).order_status ?? {};
                const allowed = ["pending", "confirmed", "processing", "delivered", "cancelled"];
                const paidStatus = allowed.includes(rules.online_paid) ? rules.online_paid : "confirmed";
                // Providers that echo our own transaction id (rather than issuing
                // one) must still resolve to the right order.
                const safeRef = providerRef.replace(/[,()]/g, "");
                const { data: matched } = await supabaseAdmin
                  .from("orders")
                  .select("id,subtotal,delivery_amount,discount_amount")
                  .eq("store_id", storeId)
                  .or(`payment_ref.eq.${safeRef},invoice_no.eq.${safeRef}`);

                // Amount guard: never confirm an underpayment.
                const reported = Number(
                  (readPath(payload, (cfg.verification?.amountPath || "amount")) as any) ?? NaN,
                );
                for (const ord of (matched ?? []) as any[]) {
                  const due =
                    Number(ord.subtotal ?? 0) +
                    Number(ord.delivery_amount ?? 0) -
                    Number(ord.discount_amount ?? 0);
                  if (Number.isFinite(reported) && reported > 0 && reported + 0.5 < due) {
                    errorMessage = `Reported amount ${reported} is below order total ${due}`;
                    processingStatus = "error";
                    statusCode = 409;
                    continue;
                  }
                  await supabaseAdmin
                    .from("orders")
                    .update({ payment_status: "paid", status: paidStatus } as any)
                    .eq("id", ord.id)
                    .neq("payment_status", "paid");
                  try {
                    const { fulfilDigitalOrder } = await import("@/lib/digital.server");
                    await fulfilDigitalOrder(ord.id);
                  } catch { /* non-fatal */ }
                }
              }
            }

          }
        } catch (e: unknown) {
          processingStatus = "error";
          statusCode = 500;
          errorMessage = e instanceof Error ? e.message : String(e);
        }

        try {
          await supabaseAdmin.from("custom_payment_gateway_events").insert({
            store_id: storeId,
            gateway_id: gatewayId,
            event_id: eventId,
            event_type: eventType,
            provider_ref: providerRef,
            normalized_status: normalized,
            payload: safeSummary(payload) as any,
            headers: headersToObject(request) as any,
            signature_valid: signatureValid,
            processing_status: processingStatus,
            error_message: errorMessage,
            processed_at: new Date().toISOString(),
          });
        } catch {
          /* logging failure is non-fatal */
        }

        return Response.json(
          { ok: statusCode < 400, source, processing_status: processingStatus, error: errorMessage },
          { status: statusCode },
        );
      },
    },
  },
});
