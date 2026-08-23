// Secure tool endpoint the AI agent calls mid-conversation.
// The caller is identified by a per-agent secret, and every action is
// re-validated against the store that secret belongs to.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  tool: z.string().min(1).max(40),
  params: z.record(z.string(), z.any()).default({}),
});

export const Route = createFileRoute("/api/public/ai-calls/tool")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-agent-secret") ?? "";
        if (secret.length < 20) return new Response("Unauthorized", { status: 401 });

        const parsed = BodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { tool, params } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: agent } = await supabaseAdmin
          .from("ai_call_agents")
          .select("id,store_id,tools")
          .eq("tool_secret", secret)
          .maybeSingle();
        const storeId = (agent as any)?.store_id;
        if (!agent || !storeId) return new Response("Unauthorized", { status: 401 });

        const { data: cfg } = await supabaseAdmin
          .from("ai_call_config")
          .select("tools")
          .eq("id", "global")
          .maybeSingle();
        const globalTools: any = (cfg as any)?.tools ?? {};
        const agentTools: any = (agent as any).tools ?? {};
        const allowed = globalTools[tool] !== false && agentTools[tool] !== false;
        if (!allowed) return Response.json({ error: "This action is not available." }, { status: 403 });

        const sb = supabaseAdmin;
        const orderId = typeof params["order_id"] === "string" ? params["order_id"] : null;

        async function loadOrder() {
          if (!orderId) return null;
          const byUuid = /^[0-9a-f-]{36}$/i.test(orderId);
          const q = sb
            .from("orders")
            .select("id,invoice_no,customer_name,phone,address,area,status,subtotal,delivery_amount,discount_amount,payment_method")
            .eq("store_id", storeId);
          const { data } = byUuid
            ? await q.eq("id", orderId).maybeSingle()
            : await q.eq("invoice_no", orderId).maybeSingle();
          return data as any;
        }

        switch (tool) {
          case "get_order": {
            const order = await loadOrder();
            if (!order) return Response.json({ error: "Order not found" });
            const { data: items } = await sb
              .from("order_items")
              .select("name_snapshot,price_snapshot,qty")
              .eq("order_id", order.id);
            return Response.json({
              order_id: order.invoice_no ?? order.id,
              customer_name: order.customer_name,
              status: order.status,
              address: [order.address, order.area].filter(Boolean).join(", "),
              payment_method: order.payment_method,
              total:
                Number(order.subtotal ?? 0) +
                Number(order.delivery_amount ?? 0) -
                Number(order.discount_amount ?? 0),
              items: (items ?? []).map((i: any) => ({
                name: i.name_snapshot,
                qty: i.qty,
                price: i.price_snapshot,
              })),
            });
          }
          case "confirm_order":
          case "cancel_order": {
            const order = await loadOrder();
            if (!order) return Response.json({ error: "Order not found" });
            const status = tool === "confirm_order" ? "confirmed" : "cancelled";
            const { error } = await sb
              .from("orders")
              .update({ status } as never)
              .eq("id", order.id)
              .eq("store_id", storeId);
            if (error) return Response.json({ error: "Could not update the order." });
            return Response.json({ ok: true, status });
          }
          case "change_address":
          case "update_order": {
            const order = await loadOrder();
            if (!order) return Response.json({ error: "Order not found" });
            const address = String(params["address"] ?? "").trim().slice(0, 300);
            if (address.length < 5) return Response.json({ error: "The new address is too short." });
            const { error } = await sb
              .from("orders")
              .update({ address } as never)
              .eq("id", order.id)
              .eq("store_id", storeId);
            if (error) return Response.json({ error: "Could not update the address." });
            return Response.json({ ok: true, address });
          }
          case "get_product":
          case "check_stock": {
            const name = String(params["name"] ?? "").trim().slice(0, 80);
            if (!name) return Response.json({ error: "Product name is required." });
            const { data } = await sb
              .from("products")
              .select("name,price,stock,status")
              .eq("store_id", storeId)
              .eq("status", "active")
              .ilike("name", `%${name}%`)
              .limit(3);
            return Response.json({ products: data ?? [] });
          }
          case "get_delivery_charge": {
            const { data } = await sb
              .from("delivery_zones")
              .select("name,charge,eta")
              .eq("store_id", storeId)
              .eq("is_active", true);
            return Response.json({ zones: data ?? [] });
          }
          case "create_callback":
          case "transfer_to_human": {
            const { data: order } = orderId ? { data: await loadOrder() } : { data: null };
            await sb.from("calls").insert({
              store_id: storeId,
              order_id: order?.id ?? null,
              phone: String(params["phone"] ?? order?.phone ?? "").slice(0, 25),
              customer_name: order?.customer_name ?? String(params["name"] ?? "").slice(0, 80),
              status: "no_answer",
              result: "callback",
              note: String(params["reason"] ?? "Requested during AI call").slice(0, 300),
            } as never);
            return Response.json({ ok: true });
          }
          case "create_support_ticket": {
            await sb.from("support_tickets").insert({
              store_id: storeId,
              subject: String(params["subject"] ?? "AI call request").slice(0, 120),
              status: "open",
            } as never);
            return Response.json({ ok: true });
          }
          default:
            return Response.json({ error: "Unknown action" }, { status: 400 });
        }
      },
    },
  },
});
