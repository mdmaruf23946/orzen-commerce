import { createFileRoute } from "@tanstack/react-router";
import { authStore, json, preflight, unauthorized } from "@/lib/call-sync.server";

const STATUSES = ["pending", "confirmed", "processing", "delivered", "cancelled"];

export const Route = createFileRoute("/api/call-sync/orders")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const auth = await authStore(request);
        if (!auth) return unauthorized();
        const { storeId, supabaseAdmin } = auth;
        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);

        let q = supabaseAdmin
          .from("orders")
          .select("id,invoice_no,customer_name,phone,subtotal,payment_method,status,followup_status,address,area,courier_name,courier_tracking_id,created_at,order_items(product_id,name_snapshot,qty,price_snapshot)")
          .eq("store_id", storeId)
          .eq("is_test", false)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (status && STATUSES.includes(status)) q = q.eq("status", status as never);
        else if (status !== "all") {
          const since = new Date(Date.now() - 30 * 86400_000).toISOString();
          q = q.or(`status.eq.pending,created_at.gte.${since}`);
        }
        const { data, error } = await q;
        if (error) return json({ ok: false, error: "query failed" }, 500);

        const orders = (data ?? []).map((o: any) => ({
          id: o.id,
          order_number: o.invoice_no ?? o.id.slice(0, 8),
          customer_name: o.customer_name,
          customer_phone: o.phone,
          total_amount: Number(o.subtotal ?? 0),
          total_price: Number(o.subtotal ?? 0),
          payment_method: String(o.payment_method ?? "").toUpperCase(),
          status: o.followup_status && o.status === "pending" ? o.followup_status : o.status,
          order_status: o.status,
          followup_status: o.followup_status ?? null,
          shipping_address: [o.address, o.area].filter(Boolean).join(", "),
          courier_name: o.courier_name ?? null,
          tracking_code: o.courier_tracking_id ?? null,
          created_at: o.created_at,
          items: (o.order_items ?? []).map((i: any) => ({
            product_id: i.product_id,
            name: i.name_snapshot,
            quantity: i.qty,
            price: Number(i.price_snapshot ?? 0),
          })),
        }));
        return json({ ok: true, count: orders.length, orders });
      },
    },
  },
});
