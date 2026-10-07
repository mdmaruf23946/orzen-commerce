// Read-only, store-scoped payment performance per gateway (real orders only).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GatewayStat = {
  gateway: string;
  total: number;
  successful: number;
  failed: number;
  pending: number;
  amount: number;
  refunds: number;
  refundAmount: number;
};

const FAILED = new Set(["failed", "expired", "cancelled"]);

export const getPaymentGatewayStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.string().uuid(),
        gatewayId: z.string().min(1).max(64).optional(),
        days: z.number().int().min(1).max(365).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: store } = await sb
      .from("stores")
      .select("id")
      .eq("id", data.storeId)
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!store) throw new Error("Store not found or access denied");

    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    let q = sb
      .from("orders")
      .select("id,invoice_no,customer_name,payment_gateway_id,payment_status,paid_amount,subtotal,created_at")
      .eq("store_id", data.storeId)
      .eq("is_test", false)
      .not("payment_gateway_id", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (data.gatewayId) q = q.eq("payment_gateway_id", data.gatewayId);
    const { data: orders, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (orders ?? []) as any[];
    const ids = rows.map((r) => r.id);
    const refundsByOrder = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: rets } = await sb
        .from("returns")
        .select("order_id,refund_amount,status")
        .eq("store_id", data.storeId)
        .in("order_id", ids.slice(i, i + 200))
        .in("status", ["refunded", "completed"]);
      for (const r of rets ?? []) {
        if (Number(r.refund_amount) > 0)
          refundsByOrder.set(r.order_id, (refundsByOrder.get(r.order_id) ?? 0) + Number(r.refund_amount));
      }
    }

    const by = new Map<string, GatewayStat>();
    for (const r of rows) {
      const g = r.payment_gateway_id as string;
      const s = by.get(g) ?? { gateway: g, total: 0, successful: 0, failed: 0, pending: 0, amount: 0, refunds: 0, refundAmount: 0 };
      s.total++;
      const ps = String(r.payment_status ?? "").toLowerCase();
      if (ps === "paid") {
        s.successful++;
        s.amount += Number(r.paid_amount) || 0;
      } else if (FAILED.has(ps)) s.failed++;
      else s.pending++;
      const ref = refundsByOrder.get(r.id);
      if (ref) {
        s.refunds++;
        s.refundAmount += ref;
      }
      by.set(g, s);
    }

    return {
      perGateway: [...by.values()],
      recent: rows.slice(0, 15).map((r) => ({
        id: r.id,
        invoice_no: r.invoice_no,
        customer_name: r.customer_name,
        gateway: r.payment_gateway_id,
        payment_status: r.payment_status,
        amount: Number(r.paid_amount) || 0,
        created_at: r.created_at,
      })),
    };
  });
