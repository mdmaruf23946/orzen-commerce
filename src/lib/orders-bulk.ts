// Client-safe helpers for Physical Orders bulk actions.
// Kept out of any *.functions.ts file so production code splitting stays safe.
import type { AdminOrderRow } from "@/lib/orders-admin.functions";

export const isPhysical = (o: AdminOrderRow) => (o.order_type ?? "physical") === "physical";

/** An order can be confirmed when it is not confirmed and not cancelled. */
export const canConfirm = (o: AdminOrderRow) =>
  o.confirmation_status !== "confirmed" && o.status !== "cancelled" && o.status !== "delivered";

export const canCancel = (o: AdminOrderRow) => o.status !== "cancelled" && o.status !== "delivered";

/** Courier dispatch only makes sense for confirmed/processing orders without a parcel. */
export const canSendToCourier = (o: AdminOrderRow) =>
  !o.parcel && (o.status === "confirmed" || o.status === "processing");

export type CourierIssue = { id: string; label: string; reason: string };

export function orderLabel(o: AdminOrderRow) {
  return o.invoice_no ?? `#${o.id.slice(0, 8).toUpperCase()}`;
}

/** Validate the customer / address / phone / COD data a courier parcel needs. */
export function validateForCourier(o: AdminOrderRow): string | null {
  if (!o.customer_name?.trim()) return "Customer name is missing";
  const digits = (o.phone ?? "").replace(/\D/g, "");
  if (!digits) return "Phone number is missing";
  if (digits.length < 10 || digits.length > 13) return "Phone number looks invalid";
  if (!o.address?.trim()) return "Delivery address is missing";
  const cod = Number(o.cod_amount);
  if (!Number.isFinite(cod) || cod < 0) return "COD amount is invalid";
  const prepaid = o.payment_method !== "cod" && o.payment_status === "paid";
  if (!prepaid && cod <= 0) return "COD amount is missing";
  return null;
}

export function splitForCourier(orders: AdminOrderRow[]) {
  const valid: AdminOrderRow[] = [];
  const invalid: CourierIssue[] = [];
  for (const o of orders) {
    if (!canSendToCourier(o)) {
      invalid.push({ id: o.id, label: orderLabel(o), reason: o.parcel ? "Already sent to courier" : "Order is not confirmed" });
      continue;
    }
    const reason = validateForCourier(o);
    if (reason) invalid.push({ id: o.id, label: orderLabel(o), reason });
    else valid.push(o);
  }
  return { valid, invalid };
}

const CSV_HEADERS = [
  "Invoice", "Order ID", "Date", "Customer", "Phone", "Address", "Area",
  "Items", "Quantity", "Subtotal", "Delivery", "Discount", "Total", "COD",
  "Payment method", "Payment status", "Status", "Courier", "Tracking",
];

function cell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ordersToCsv(orders: AdminOrderRow[]) {
  const lines = [CSV_HEADERS.join(",")];
  for (const o of orders) {
    lines.push([
      o.invoice_no ?? "",
      o.id,
      new Date(o.created_at).toISOString(),
      o.customer_name,
      o.phone,
      o.address,
      o.area ?? "",
      o.items.map((i) => `${i.name} x${i.qty}`).join(" | "),
      o.qty,
      o.subtotal,
      o.delivery,
      o.discount,
      o.total,
      o.cod_amount,
      o.payment_method,
      o.payment_status,
      o.status,
      o.courier_key ?? "",
      o.tracking ?? "",
    ].map(cell).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Shape an order into the parcel-like record `openPrintWindow` expects. */
export function orderToPrintParcel(o: AdminOrderRow) {
  return {
    id: o.id,
    order_id: o.id,
    courier_key: o.courier_key ?? "",
    recipient_name: o.customer_name,
    recipient_phone: o.phone,
    recipient_address: [o.address, o.area].filter(Boolean).join(", "),
    cod_amount: o.cod_amount,
    items: o.items,
    tracking_code: o.tracking ?? null,
    note: null,
  };
}
