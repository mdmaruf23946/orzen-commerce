// Public webhook endpoint per provider. Each provider adapter parses
// its own payload / verifies its own signature. Anyone can POST here,
// but the adapter's `parseWebhook` + verification are the guard rails.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/subscription-pay/webhook/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const providerId = params.provider;
          const { loadProvider } = await import("@/lib/subscription-pay/pay.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const provider = await loadProvider(providerId);
          if (!provider.adapter.parseWebhook) {
            return new Response("Provider does not accept webhooks", { status: 400 });
          }
          const parsed = await provider.adapter.parseWebhook(provider.config, request);
          if (!parsed.provider_ref) {
            return new Response("Missing provider_ref", { status: 400 });
          }
          // Locate the invoice by tran_id / provider_ref (we set tran_id = invoice_no)
          const invoiceNo = parsed.provider_ref;
          const { data: inv } = await supabaseAdmin
            .from("subscription_invoices")
            .select("id, user_id, store_id, invoice_no, total, purpose")
            .eq("invoice_no", invoiceNo)
            .maybeSingle();
          if (!inv) return new Response("Unknown invoice", { status: 404 });

          const result = await provider.adapter.verifyPayment(provider.config, {
            provider_ref: parsed.provider_ref,
            raw: parsed.raw,
          });

          await supabaseAdmin
            .from("subscription_transactions")
            .update({
              status: result.status === "paid" ? "success" : result.status === "failed" ? "failed" : "pending",
              method: result.method ?? null,
              raw: parsed.raw,
              verified_at: new Date().toISOString(),
            })
            .eq("invoice_id", (inv as any).id);

          if (result.status === "paid" && (inv as any).purpose === "wallet_topup") {
            const { creditTopupInvoice } = await import("@/lib/wallet.server");
            await creditTopupInvoice(supabaseAdmin as any, inv);
            await supabaseAdmin
              .from("subscription_invoices")
              .update({ status: "paid", paid_at: new Date().toISOString() })
              .eq("id", (inv as any).id);
          } else if (result.status === "paid") {
            // Mark invoice paid; UI verify call will run activation next time
            // the customer returns. Idempotent — safe to run twice.
            await supabaseAdmin
              .from("subscription_invoices")
              .update({ status: "paid", paid_at: new Date().toISOString() })
              .eq("id", (inv as any).id);
          } else if (result.status === "failed") {
            await supabaseAdmin
              .from("subscription_invoices")
              .update({ status: "failed" })
              .eq("id", (inv as any).id);
          }
          if (result.status === "paid") {
            // Main-website Meta Purchase after verified payment (idempotent per invoice).
            const { trackVerifiedPayment } = await import("@/lib/platform-meta.server");
            await trackVerifiedPayment({
              invoiceId: (inv as any).id,
              userId: (inv as any).user_id,
              amount: Number((inv as any).total ?? 0),
              purpose: (inv as any).purpose === "wallet_topup" ? "wallet_topup" : "subscription",
            });
          }
          return Response.json({ ok: true, status: result.status });
        } catch (e: any) {
          console.error("[subscription-pay webhook]", e);
          return new Response(e?.message ?? "Error", { status: 500 });
        }
      },
    },
  },
});
