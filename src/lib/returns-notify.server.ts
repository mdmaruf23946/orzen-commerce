// Server-only notification fan-out for Returns & Exchanges.
// Every status change notifies the customer (email + SMS when configured),
// the store admin (in-app) and the platform owner (in-app). Best effort only:
// a failure here must never roll back the status transition.
import { STATUS_LABEL } from "@/lib/returns-pricing";

type Ret = {
  id: string;
  store_id: string;
  order_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  request_kind?: string | null;
  refund_amount?: number | null;
  extra_payment_due?: number | null;
};

const money = (n: any) => `৳${Number(n ?? 0).toFixed(0)}`;

function customerMessage(r: Ret, status: string, storeName: string) {
  const ref = r.id.slice(0, 8).toUpperCase();
  const label = STATUS_LABEL[status] ?? status;
  switch (status) {
    case "requested":
      return `Your return/exchange request ${ref} has been created at ${storeName}. We will review it shortly.`;
    case "approved":
      return `Good news — request ${ref} was approved. Please keep the item ready for pickup.`;
    case "rejected":
      return `Request ${ref} could not be approved. Contact ${storeName} for details.`;
    case "shipment_created":
      return `A return shipment was created for request ${ref}.`;
    case "in_transit":
      return `Your returned item for ${ref} is on the way back to ${storeName}.`;
    case "received":
      return `${storeName} received your returned item for request ${ref}.`;
    case "inspection_passed":
      return `Inspection passed for request ${ref}. Your refund or replacement is being processed.`;
    case "inspection_failed":
      return `Inspection did not pass for request ${ref}. ${storeName} will contact you.`;
    case "replacement_created":
      return `A replacement order was created for request ${ref}.`;
    case "refund_pending":
      return `Your refund of ${money(r.refund_amount)} for request ${ref} is pending.`;
    case "refunded":
      return `Your refund of ${money(r.refund_amount)} for request ${ref} has been completed.`;
    case "refund_rejected":
      return `The refund for request ${ref} was declined. Contact ${storeName} for details.`;
    case "completed":
      return `Request ${ref} is now complete. Thank you for shopping with ${storeName}.`;
    case "cancelled":
      return `Request ${ref} was cancelled.`;
    default:
      return `Request ${ref}: ${label}.`;
  }
}

export async function notifyReturnStatus(
  sb: any,
  ret: Ret,
  status: string,
  note?: string | null,
  opts: { notifyCustomer?: boolean } = {},
) {
  try {
    const label = STATUS_LABEL[status] ?? status;
    const ref = ret.id.slice(0, 8).toUpperCase();

    const { data: store } = await sb
      .from("stores")
      .select("id,name,owner_user_id")
      .eq("id", ret.store_id)
      .maybeSingle();
    const storeName = (store as any)?.name ?? "the store";

    const body =
      `${ret.customer_name ?? "Customer"} · ${ret.request_kind ?? "return"}` +
      (Number(ret.extra_payment_due ?? 0) > 0
        ? ` · customer pays ${money(ret.extra_payment_due)}`
        : Number(ret.refund_amount ?? 0) > 0
          ? ` · refund ${money(ret.refund_amount)}`
          : "") +
      (note ? ` — ${note}` : "");

    // Store admin inbox.
    await sb.from("admin_notifications").insert({
      store_id: ret.store_id,
      kind: "return_status",
      type: "return",
      title: `Return ${ref}: ${label}`,
      body,
      priority: status === "requested" ? "high" : "normal",
      action_label: "Open request",
      action_type: "route",
      action_target: "/admin/returns",
      meta: { return_id: ret.id, order_id: ret.order_id, status },
    } as any);

    // Platform owner inbox (store_id null = platform-level row).
    await sb.from("admin_notifications").insert({
      store_id: null,
      kind: "return_status",
      type: "return",
      title: `${storeName}: return ${ref} — ${label}`,
      body,
      priority: "low",
      meta: { return_id: ret.id, order_id: ret.order_id, store_id: ret.store_id, status },
    } as any);

    // Store's own notification channels.
    let custEmail: string | null = null;
    let custPhone: string | null = null;
    {
      const { data: o } = await sb
        .from("orders")
        .select("email,phone")
        .eq("id", ret.order_id)
        .maybeSingle();
      custEmail = (o as any)?.email ?? null;
      custPhone = (o as any)?.phone ?? null;
    }
    try {
      const { dispatchNotification } = await import("@/lib/notify-dispatch.server");
      await dispatchNotification(sb, {
        storeId: ret.store_id,
        event: "return_update",
        subject: `Return ${ref}: ${label}`,
        message: `${storeName} — return ${ref} is now ${label}.${note ? " " + note : ""}`,
        customer: opts.notifyCustomer === false ? null : { email: custEmail, phone: custPhone },
      });
    } catch { /* best effort */ }

    if (opts.notifyCustomer === false) return;

    // Customer SMS — only when the store has an SMS sender configured.
    const message = customerMessage(ret, status, storeName);
    try {
      const sender = process.env["GATEWAYAPI_API_KEY"];
      const lovableKey = process.env["LOVABLE_API_KEY"];
      const phone = (ret.phone ?? "").replace(/[^0-9]/g, "");
      if (sender && lovableKey && phone) {
        await fetch("https://connector-gateway.lovable.dev/gatewayapi/mobile/single", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": sender,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: storeName.slice(0, 11) || "Store",
            recipient: Number(phone.startsWith("880") ? phone : `88${phone}`),
            message,
            reference: `return-${ret.id}-${status}`,
          }),
        });
      }
    } catch (e) {
      console.error("[returns] sms failed", e);
    }
  } catch (e) {
    console.error("[returns] notify failed", e);
  }
}
