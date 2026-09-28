// Idempotent, transactional chat order creation (Messenger / WhatsApp).
// The same order key within 30 minutes always returns the first order —
// never a second invoice. Stock is checked under a row lock.
import { createHash } from "crypto";

export function buildIdempotencyKey(p: {
  channel: string;
  conversationId: string | null | undefined;
  productId: string;
  variant?: string | null;
  qty: number;
  phone: string | null | undefined;
}) {
  const digits = String(p.phone ?? "").replace(/\D/g, "").slice(-10);
  const raw = [p.channel, p.conversationId ?? "-", p.productId, p.variant ?? "", Number(p.qty) || 1, digits].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

export type ChatOrderInput = {
  customer_name: string;
  phone: string;
  email?: string | null;
  address: string;
  area?: string | null;
  payment_method?: string | null;
  subtotal: number;
  delivery_amount: number;
  delivery_zone_id?: string | null;
  discount_amount?: number;
  notes?: string | null;
  customer_id?: string | null;
};

export type ChatOrderResult =
  | { ok: true; id: string; invoice_no: string | null; existing: boolean }
  | { ok: false; error: "out_of_stock"; available: number }
  | { ok: false; error: string };

export async function createChatOrder(
  sb: any,
  storeId: string,
  key: string,
  order: ChatOrderInput,
  items: { product_id: string; name: string; price: number; qty: number }[],
): Promise<ChatOrderResult> {
  const { data, error } = await sb.rpc("create_chat_order", {
    _store_id: storeId,
    _idem_key: key,
    _order: order,
    _items: items,
  });
  if (error) {
    const m = String(error.message ?? "");
    const oos = m.match(/out_of_stock:(\d+)/);
    if (oos) return { ok: false, error: "out_of_stock", available: Number(oos[1]) };
    if (m.includes("product_not_found")) return { ok: false, error: "product_not_found" };
    return { ok: false, error: m || "insert_failed" };
  }
  const r = data as { id: string; invoice_no: string | null; existing: boolean };
  return { ok: true, id: r.id, invoice_no: r.invoice_no, existing: !!r.existing };
}
