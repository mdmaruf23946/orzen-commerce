// Cron endpoint: drains order_notifications_outbox by sending Messenger updates.
// Call every 1-2 min from pg_cron or an external scheduler with
//   Authorization: Bearer <CRON_SECRET>
import { createFileRoute } from "@tanstack/react-router";
import { sendText } from "@/lib/messenger-send.server";

const STAGE_MESSAGES: Record<string, (o: any) => string> = {
  placed: (o) => `✅ We received your order ${o.invoice_no ? "#" + o.invoice_no : ""}. We'll confirm shortly.`,
  confirmed: (o) => `🎉 Your order ${o.invoice_no ? "#" + o.invoice_no : ""} is confirmed. Total: ৳${o.grand_total}.`,
  packed: (o) => `📦 Your order ${o.invoice_no ? "#" + o.invoice_no : ""} has been packed and is being handed to the courier.`,
  shipped: (o) => `🚚 Your order ${o.invoice_no ? "#" + o.invoice_no : ""} has been shipped.${o.courier_tracking_id ? " Tracking: " + o.courier_tracking_id : ""}`,
  delivered: (o) => `✅ Your order ${o.invoice_no ? "#" + o.invoice_no : ""} has been delivered. Thank you!`,
  cancelled: (o) => `❌ Your order ${o.invoice_no ? "#" + o.invoice_no : ""} has been cancelled. Contact us if this is unexpected.`,
};

export const Route = createFileRoute("/api/public/cron/notify-orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const secret = process.env.CRON_SECRET;
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: pending } = await supabaseAdmin
          .from("order_notifications_outbox")
          .select("id,order_id,store_id,stage,attempt_count")
          .is("sent_at", null)
          .lt("attempt_count", 4)
          .order("created_at", { ascending: true })
          .limit(50);

        let sent = 0;
        let failed = 0;

        for (const row of pending ?? []) {
          try {
            const builder = STAGE_MESSAGES[row.stage];
            if (!builder) {
              await supabaseAdmin
                .from("order_notifications_outbox")
                .update({ sent_at: new Date().toISOString(), error: "no_template" })
                .eq("id", row.id);
              continue;
            }

            const { data: order } = await supabaseAdmin
              .from("orders")
              .select("id,invoice_no,phone,subtotal,delivery_amount,courier_tracking_id")
              .eq("id", row.order_id)
              .maybeSingle();
            if (!order) throw new Error("order_missing");
            const orderView = {
              ...order,
              grand_total: Number(order.subtotal ?? 0) + Number(order.delivery_amount ?? 0),
            };
            const text = builder(orderView);

            // Find the customer's PSID from an existing Messenger conversation
            const phoneNorm = order.phone ? String(order.phone).replace(/\D/g, "") : null;
            const { data: conv } = await supabaseAdmin
              .from("ai_conversations")
              .select("external_id")
              .eq("store_id", row.store_id)
              .eq("channel", "messenger")
              .eq("phone", phoneNorm)
              .not("external_id", "is", null)
              .order("last_message_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!conv?.external_id) {
              // No Messenger channel: mark as skipped, don't retry forever
              await supabaseAdmin
                .from("order_notifications_outbox")
                .update({ sent_at: new Date().toISOString(), error: "no_psid" })
                .eq("id", row.id);
              continue;
            }

            const { data: integ } = await supabaseAdmin
              .from("messenger_integrations")
              .select("page_access_token")
              .eq("store_id", row.store_id)
              .maybeSingle();
            const token = integ?.page_access_token;
            if (!token) throw new Error("no_page_token");

            await sendText(token, conv.external_id, text);

            await supabaseAdmin
              .from("order_notifications_outbox")
              .update({ sent_at: new Date().toISOString() })
              .eq("id", row.id);
            sent++;
          } catch (e) {
            failed++;
            await supabaseAdmin
              .from("order_notifications_outbox")
              .update({
                attempt_count: (row.attempt_count ?? 0) + 1,
                error: (e as Error).message.slice(0, 500),
              })
              .eq("id", row.id);
          }
        }

        return Response.json({ ok: true, sent, failed, considered: pending?.length ?? 0 });
      },
    },
  },
});
