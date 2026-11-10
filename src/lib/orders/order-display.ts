// Shared, product-type aware presentation helpers for the customer account.
export type OrderType = "physical" | "digital" | "service" | "subscription";

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  physical: "Physical",
  digital: "Digital",
  service: "Service",
  subscription: "Subscription",
};

export const ORDER_TYPE_TONE: Record<OrderType, string> = {
  physical: "bg-sky-50 text-sky-700 ring-sky-200",
  digital: "bg-violet-50 text-violet-700 ring-violet-200",
  service: "bg-amber-50 text-amber-700 ring-amber-200",
  subscription: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

/** The single action a card offers, decided purely by product type. */
export const ORDER_TYPE_ACTION: Record<OrderType, string> = {
  physical: "View tracking",
  digital: "Download files",
  service: "Manage service",
  subscription: "Manage subscription",
};

export function asOrderType(v: unknown): OrderType {
  return v === "digital" || v === "service" || v === "subscription" ? v : "physical";
}

export function statusTone(status: string) {
  switch (status) {
    case "delivered":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "cancelled":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "confirmed":
    case "processing":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    default:
      return "bg-neutral-100 text-neutral-700 ring-neutral-200";
  }
}

export function paymentTone(status: string) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

/** Cancellation stays open until the parcel is handed to the courier. */
export function canCancel(order: {
  order_type: string;
  status: string;
  confirmation_status?: string;
  shipped?: boolean;
  courier_tracking_id?: string | null;
}) {
  if (order.order_type === "subscription") return false;
  if (order.status === "cancelled" || order.status === "delivered") return false;
  if (order.shipped) return false;
  if (order.courier_tracking_id) return false;
  return true;
}

/** Cash on delivery / offline methods never go through a payment gateway. */
export function isCodMethod(method?: string | null) {
  return String(method ?? "cod").toLowerCase() === "cod";
}

export function paymentStatusLabel(method: string | null | undefined, status: string) {
  if (status === "paid") return "PAID";
  if (isCodMethod(method) && (status === "pending" || status === "unpaid"))
    return "PAY ON DELIVERY";
  return String(status ?? "pending").toUpperCase();
}

export function taka(n: any) {
  return `৳${Number(n || 0).toLocaleString()}`;
}
