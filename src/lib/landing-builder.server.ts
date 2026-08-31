// Server-only order intake for builder landing pages.
// Creates a normal store order (source = 'landing_page') so it shows up in the
// regular Orders section, without touching the product or storefront config.
import { z } from "zod";

export const lpOrderSchema = z.object({
  customer_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
  address: z.string().trim().min(3).max(500),
  area: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  note: z.string().trim().max(500).optional().nullable(),
  payment_method: z.enum(["cod", "bkash", "nagad", "rocket", "bank"]).default("cod"),
  txn_id: z.string().trim().max(120).optional().nullable(),
  page_url: z.string().trim().max(500).optional().nullable(),
  delivery_zone: z.string().trim().max(60).optional().nullable(),
});

export type LpOrderInput = z.infer<typeof lpOrderSchema>;

export type LpOrderResult = { status: number; body: Record<string, unknown> };

export async function createLandingPageOrder(
  landingPageId: string,
  raw: unknown,
): Promise<LpOrderResult> {
  const parsed = lpOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 422, body: { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" } };
  }
  const input = parsed.data;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin;

  const { data: page } = await sb
    .from("landing_pages")
    .select("id,store_id,product_id,status,slug,form_config,orders_count")
    .eq("id", landingPageId)
    .maybeSingle();

  if (!page || page.status !== "published") {
    return { status: 404, body: { ok: false, error: "Landing page not available" } };
  }
  if (!page.product_id) {
    return { status: 422, body: { ok: false, error: "This landing page has no product" } };
  }

  const cfg = (page.form_config ?? {}) as {
    paymentMethods?: string[];
    deliveryCharge?: number;
    deliveryZones?: unknown;
  };
  const allowed = cfg.paymentMethods?.length ? cfg.paymentMethods : ["cod"];
  const method = allowed.includes(input.payment_method) ? input.payment_method : allowed[0]!;

  const { data: product } = await sb
    .from("products")
    .select("id,name,price,stock,status,store_id")
    .eq("id", page.product_id)
    .eq("store_id", page.store_id)
    .maybeSingle();

  if (!product || product.status === "draft") {
    return { status: 422, body: { ok: false, error: "Product is not available" } };
  }
  if ((product.stock ?? 0) <= 0) {
    return { status: 409, body: { ok: false, error: "Out of stock" } };
  }

  const qty = Math.min(input.quantity, Math.max(1, product.stock ?? 1));
  const price = Number(product.price) || 0;
  const { resolveDeliveryCharge } = await import("@/lib/landing-builder");
  const { charge: delivery, zone } = resolveDeliveryCharge(cfg, input.delivery_zone ?? null);

  const { data: order, error: orderErr } = await sb
    .from("orders")
    .insert({
      store_id: page.store_id,
      customer_name: input.customer_name,
      phone: input.phone,
      address: input.address,
      area: input.area || zone?.name || null,
      email: input.email || null,
      payment_method: method as "cod" | "bkash" | "nagad" | "rocket" | "bank",
      txn_id: input.txn_id || null,
      notes: input.note || null,
      subtotal: price * qty,
      delivery_amount: delivery,
      status: "pending",
      source: "landing_page",
      order_type: "physical",
      landing_page_url: input.page_url || `/lp/${page.slug}`,
    })
    .select("id,invoice_no")
    .single();

  if (orderErr || !order) {
    return { status: 500, body: { ok: false, error: "Could not create order" } };
  }

  const { error: itemErr } = await sb.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    name_snapshot: product.name,
    price_snapshot: price,
    qty,
  });
  if (itemErr) {
    return { status: 500, body: { ok: false, error: "Order created but item failed" } };
  }

  await sb
    .from("landing_pages")
    .update({ orders_count: (page.orders_count ?? 0) + 1 })
    .eq("id", page.id);

  return {
    status: 200,
    body: { ok: true, order_id: order.id, invoice_no: order.invoice_no ?? null },
  };
}
