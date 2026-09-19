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
    const itemLines = ((items ?? []) as any[])
      .map((i) => `${i.name_snapshot} × ${i.qty} — ${money(Number(i.price_snapshot) * Number(i.qty))}`)
      .join("\n");
    const { dispatchNotification } = await import("@/lib/notify-dispatch.server");
    await dispatchNotification(sb, {
      storeId: order.store_id,
      event: "order_confirmed",
      subject: `${storeName} — order ${ref} confirmed`,
      message: `Hi ${order.customer_name}, your order ${ref} with ${storeName} is confirmed.\n\n${itemLines}\nTotal: ${money(total)}${Number(order.due_amount ?? 0) > 0 ? `\nDue on delivery: ${money(order.due_amount)}` : ""}\n\nDelivering to: ${order.address ?? ""}${order.area ? `, ${order.area}` : ""}`,
      customer: { email: order.email, phone: order.phone },
    });
  } catch (e) {
    console.error("[quick-order] email failed", e);
  }
}
