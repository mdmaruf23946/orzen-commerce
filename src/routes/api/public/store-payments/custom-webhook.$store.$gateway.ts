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
            if (
              processingStatus === "processed" &&
              providerRef &&
              ["paid", "success", "completed", "succeeded"].includes(String(normalized).toLowerCase())
            ) {
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
              await supabaseAdmin
                .from("orders")
                .update({ payment_status: "paid", status: paidStatus } as any)
                .eq("store_id", storeId)
                .or(`payment_ref.eq.${safeRef},invoice_no.eq.${safeRef}`);
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
