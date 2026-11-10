// Shared, store-scoped "where is my order?" lookup used by every channel
// (website chat, Messenger, WhatsApp, AI phone calls) so an order placed on
// any channel can be tracked from any other one by phone or invoice number.

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
/** Convert Bengali digits (০-৯) to ASCII digits. */
export function toAsciiDigits(s: string | null | undefined): string {
  return String(s ?? "").replace(/[০-৯]/g, (c) => String(BN_DIGITS.indexOf(c)));
}

/** Last 10 digits of a Bangladeshi number in any format (+880 / 880 / 01… / Bengali digits). */
export function phoneTail(p: string | null | undefined): string | null {
  const d = toAsciiDigits(p).replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

/** Pull the first BD mobile number out of free text ("amar number ০১৭১২-৩৪৫ ৬৭৮"). */
export function extractPhone(text: string | null | undefined): string | null {
  const cleaned = toAsciiDigits(text).replace(/[\s\-_().,]/g, "");
  const m = cleaned.match(/(?:\+?88)?0?1[3-9]\d{8}/);
  if (!m) return null;
  const raw = m[0].replace(/^\+?88/, "");
  return raw.startsWith("0") ? raw : `0${raw}`;
}

const STATUS_BN: Record<string, string> = {
  pending: "অর্ডারটি আমরা পেয়েছি, শীঘ্রই কনফার্ম করা হবে",
  incomplete: "অর্ডারটি এখনো সম্পূর্ণ হয়নি",
  no_response: "অর্ডার কনফার্ম করতে আমরা আপনার সাথে যোগাযোগের চেষ্টা করছি",
  on_hold: "অর্ডারটি সাময়িকভাবে হোল্ডে আছে",
  confirmed: "অর্ডারটি কনফার্ম হয়েছে",
  processing: "অর্ডারটি প্যাকেজিং/প্রসেসিং চলছে",
  ready_to_send: "পার্সেলটি কুরিয়ারে পাঠানোর জন্য প্রস্তুত",
  shipped: "পার্সেলটি কুরিয়ারে পাঠানো হয়েছে",
  in_transit: "পার্সেলটি কুরিয়ারের মাধ্যমে পথে আছে",
  delivered: "পার্সেলটি ডেলিভারি সম্পন্ন হয়েছে",
  cancelled: "অর্ডারটি বাতিল অবস্থায় আছে",
  returned: "পার্সেলটি ফেরত এসেছে",
};

export function statusTextBn(status: string | null | undefined): string {
  return STATUS_BN[String(status ?? "")] ?? String(status ?? "অজানা");
}

export type TrackedOrder = {
  invoice_no: string;
  status: string;
  status_text_bn: string;
  customer_name: string | null;
  ordered_at: string;
  total: number;
  items: { name: string; qty: number }[];
  courier_name: string | null;
  courier_tracking_id: string | null;
  courier_status: string | null;
};

/**
 * Find a store's recent orders by phone and/or invoice number.
 * When both are given the invoice must belong to that phone (privacy).
 */
export async function lookupOrders(
  sb: any,
  storeId: string,
  opts: { phone?: string | null; invoice?: string | null; limit?: number },
): Promise<TrackedOrder[]> {
  const tail = phoneTail(opts.phone);
  const invoice = String(opts.invoice ?? "").replace(/^#/, "").trim();
  if (!tail && !invoice) return [];
  let q = sb
    .from("orders")
    .select(
      "id,invoice_no,status,customer_name,phone,subtotal,created_at,courier_name,courier_tracking_id,courier_status",
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(Math.min(opts.limit ?? 3, 5));
  if (invoice) q = q.ilike("invoice_no", `%${invoice.replace(/[%_]/g, "")}%`);
  if (tail) q = q.ilike("phone", `%${tail}`);
  const { data } = await q;
  const rows: any[] = data ?? [];
  if (!rows.length) return [];
  const { data: items } = await sb
    .from("order_items")
    .select("order_id,name_snapshot,qty")
    .in("order_id", rows.map((r) => r.id));
  return rows.map((r) => ({
    invoice_no: r.invoice_no ?? String(r.id).slice(0, 8),
    status: r.status,
    status_text_bn: statusTextBn(r.status),
    customer_name: r.customer_name ?? null,
    ordered_at: r.created_at,
    // orders.subtotal already stores the grand total.
    total: Number(r.subtotal ?? 0),
    items: (items ?? [])
      .filter((i: any) => i.order_id === r.id)
      .map((i: any) => ({ name: i.name_snapshot, qty: Number(i.qty ?? 1) })),
    courier_name: r.courier_name ?? null,
    courier_tracking_id: r.courier_tracking_id ?? null,
    courier_status: r.courier_status ?? null,
  }));
}

export const TRACKING_GUIDE =
  "If orders is empty and no phone was known, ask for the mobile number used to order (or invoice no). " +
  "If empty for the caller's/customer's own number, say no order was found on this number and ask whether they ordered with another number. " +
  "If one order: give product names, status_text_bn and courier name/tracking id if present. " +
  "If several: list them briefly (invoice, product, status) and ask which one. Never invent delivery dates.";
