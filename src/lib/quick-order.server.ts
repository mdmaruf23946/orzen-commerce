// Notifications for manually created (Quick Order) orders: an in-app alert for
// the store admin and a confirmation email for the shopper.
type Sb = any;

const money = (n: number) => `৳${Math.round(Number(n) || 0).toLocaleString("en-US")}`;

export async function notifyQuickOrder(sb: Sb, orderId: string) {
  const { data: order } = await sb
    .from("orders")
    .select(
      "id,store_id,invoice_no,customer_name,phone,email,address,area,subtotal,delivery_amount,discount_amount,paid_amount,due_amount,payment_method",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const { data: items } = await sb
    .from("order_items")
    .select("name_snapshot,price_snapshot,qty")
    .eq("order_id", orderId);

  const { data: store } = await sb
    .from("stores")
    .select("name,slug")
    .eq("id", order.store_id)
    .maybeSingle();
  const storeName = store?.name ?? "Store";
  const ref = order.invoice_no ?? order.id.slice(0, 8).toUpperCase();
  const total = Number(order.subtotal ?? 0);

  // Store admin inbox.
  try {
    await sb.from("admin_notifications").insert({
      store_id: order.store_id,
      kind: "order_manual",
      type: "order",
      title: `Manual order ${ref} created`,
      body: `${order.customer_name} · ${money(total)}${
        Number(order.due_amount ?? 0) > 0 ? ` · due ${money(order.due_amount)}` : " · paid"
      }`,
      priority: "normal",
      action_label: "Open order",
      action_type: "route",
      action_target: "/admin/orders",
      meta: { order_id: order.id, source: "manual" },
    });
  } catch (e) {
    console.error("[quick-order] inbox failed", e);
  }

  // Shopper confirmation email.
  if (!order.email) return;
  try {
    const rows = ((items ?? []) as any[])
      .map(
        (i) =>
          `<tr><td style="padding:6px 0">${i.name_snapshot} × ${i.qty}</td><td style="padding:6px 0;text-align:right">${money(
            Number(i.price_snapshot) * Number(i.qty),
          )}</td></tr>`,
      )
      .join("");

    const { enqueueEmail } = await import("@/lib/emails.server");
    await enqueueEmail({
      to: order.email,
      template: "order_confirmation",
      subject: `${storeName} — order ${ref} confirmed`,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111">
        <p>Hi ${order.customer_name},</p>
        <p>We've placed your order <strong>${ref}</strong> with ${storeName}.</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">${rows}
          <tr><td style="padding:6px 0;border-top:1px solid #eee"><strong>Total</strong></td>
              <td style="padding:6px 0;border-top:1px solid #eee;text-align:right"><strong>${money(total)}</strong></td></tr>
          ${
            Number(order.due_amount ?? 0) > 0
              ? `<tr><td style="padding:6px 0">Due on delivery</td><td style="padding:6px 0;text-align:right">${money(order.due_amount)}</td></tr>`
              : ""
          }
        </table>
        <p style="color:#666">Delivering to: ${order.address ?? ""}${order.area ? `, ${order.area}` : ""}</p>
      </div>`,
      payload: { order_id: order.id, source: "manual" },
    });
  } catch (e) {
    console.error("[quick-order] email failed", e);
  }
}
