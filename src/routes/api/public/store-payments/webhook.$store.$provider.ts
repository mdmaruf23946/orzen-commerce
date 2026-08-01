// Store-scoped payment gateway webhook receiver.
// Delegates payload parsing to the provider adapter, then logs every
// delivery (live or test) into public.payment_webhook_events so store
// owners can inspect what arrived from their processor.
import { createFileRoute } from "@tanstack/react-router";

function summarize(payload: any) {
  try {
    if (payload == null) return null;
    if (typeof payload !== "object") return { value: String(payload).slice(0, 500) };
    const out: Record<string, unknown> = {};
    const keys = Object.keys(payload).slice(0, 20);
    for (const k of keys) {
      const v = (payload as any)[k];
      if (v == null || typeof v === "boolean" || typeof v === "number") out[k] = v;
      else if (typeof v === "string") out[k] = v.length > 200 ? v.slice(0, 200) + "…" : v;
      else out[k] = "[object]";
    }
    return out;
  } catch {
    return null;
  }
}

function headersToObject(req: Request) {
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (["authorization", "cookie", "x-api-key"].includes(lk)) return;
    out[k] = v.length > 300 ? v.slice(0, 300) + "…" : v;
  });
  return out;
}

export const Route = createFileRoute("/api/public/store-payments/webhook/$store/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { store: storeId, provider: providerId } = params;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const source = new URL(request.url).searchParams.get("source") === "test" ? "test" : "live";

        // Snapshot request early so parseWebhook can consume the body clone.
        const cloned = request.clone();

        let signatureValid: boolean | null = null;
        let verifiedStatus: string | null = null;
        let providerRef: string | null = null;
        let method: string | null = null;
        let amount: number | null = null;
        let currency: string | null = null;
        let statusCode = 200;
        let errorMessage: string | null = null;
        let payload: any = null;

        try {
          // Load the store's connection so we can pass credentials.
          const { data: conn } = await supabaseAdmin
            .from("store_payment_gateways")
            .select("credentials_ciphertext, sandbox")
            .eq("store_id", storeId)
            .eq("provider_id", providerId)
            .maybeSingle();

          const { getProvider } = await import("@/lib/subscription-pay/providers/registry");
          const provider = getProvider(providerId);

          if (!provider.parseWebhook) {
            statusCode = 400;
            errorMessage = "Provider adapter does not implement parseWebhook";
          } else {
            let creds: Record<string, unknown> = {};
            if (conn?.credentials_ciphertext) {
              try {
                const { decryptJSON } = await import("@/lib/crypto/credentials.server");
                creds = decryptJSON<Record<string, unknown>>(conn.credentials_ciphertext);
              } catch {
                /* keep empty */
              }
            }
            const cfg = { credentials: creds as any, sandbox: !!conn?.sandbox };
            const parsed = await provider.parseWebhook(cfg, cloned);
            payload = parsed.raw;
            providerRef = parsed.provider_ref || null;

            // Signature verification is a no-op for adapters that don't
            // expose one; we record `null` to mean "not evaluated".
            signatureValid = null;

            if (providerRef && source === "live") {
              try {
                const verify = await provider.verifyPayment(cfg, {
                  provider_ref: providerRef,
                  raw: parsed.raw,
                });
                verifiedStatus = verify.status;
                method = verify.method ?? null;
                amount = Number(verify.amount ?? 0) || null;
                currency = verify.currency ?? null;

                // Reconcile the order once the provider confirms payment.
                if (verify.status === "paid") {
                  const { data: st } = await supabaseAdmin
                    .from("stores")
                    .select("payments_config")
                    .eq("id", storeId)
                    .maybeSingle();
                  const rules: any = ((st as any)?.payments_config ?? {}).order_status ?? {};
                  const allowed = ["pending", "confirmed", "processing", "delivered", "cancelled"];
                  const paidStatus = allowed.includes(rules.online_paid) ? rules.online_paid : "confirmed";
                  const refs = Array.from(
                    new Set(
                      [providerRef, verify.provider_ref]
                        .filter((r): r is string => !!r)
                        .map((r) => r.replace(/[,()]/g, "")),
                    ),
                  );
                  const filter = refs
                    .flatMap((r) => [`payment_ref.eq.${r}`, `invoice_no.eq.${r}`])
                    .join(",");
                  if (filter) {
                    const { data: matched } = await supabaseAdmin
                      .from("orders")
                      .select("id,subtotal,delivery_amount,discount_amount")
                      .eq("store_id", storeId)
                      .or(filter);
                    for (const ord of (matched ?? []) as any[]) {
                      const due =
                        Number(ord.subtotal ?? 0) +
                        Number(ord.delivery_amount ?? 0) -
                        Number(ord.discount_amount ?? 0);
                      // Never confirm an underpayment — log it instead.
                      if (amount != null && amount > 0 && amount + 0.5 < due) {
                        errorMessage = `Reported amount ${amount} is below order total ${due}`;
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

              } catch (e: any) {
                errorMessage = `verifyPayment failed: ${e?.message ?? e}`;
              }
            } else if (source === "test") {
              verifiedStatus = "test";
            }
          }
        } catch (e: any) {
          statusCode = 500;
          errorMessage = e?.message ?? String(e);
          try {
            payload = await request.clone().json();
          } catch {
            try {
              payload = { _raw: (await request.clone().text()).slice(0, 500) };
            } catch {
              /* ignore */
            }
          }
        }

        await supabaseAdmin.from("payment_webhook_events").insert({
          store_id: storeId,
          provider_id: providerId,
          source,
          signature_valid: signatureValid,
          verified_status: verifiedStatus,
          provider_ref: providerRef,
          method,
          amount,
          currency,
          payload_summary: summarize(payload) as any,
          headers: headersToObject(request) as any,
          status_code: statusCode,
          error_message: errorMessage,
        });

        return Response.json(
          { ok: statusCode < 400, provider_ref: providerRef, error: errorMessage },
          { status: statusCode },
        );
      },
    },
  },
});
