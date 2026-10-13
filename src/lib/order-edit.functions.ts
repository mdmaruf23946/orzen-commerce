// Edit customer / items / charges of an order — only while it is still pending.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { myStoreRow, resolveStoreAccess } from "@/lib/store-access";

async function loadPendingOrder(supabase: any, userId: string, orderId: string) {
  const store = await myStoreRow(supabase, userId, "id", "finance");
  if (!store?.id) throw new Error("No store");
  const { data: order, error } = await supabase
    .from("orders").select("id,status,store_id,delivery_amount,discount_amount,paid_amount")
    .eq("id", orderId).eq("store_id", store.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("Order not found");
  if (order.status !== "pending") throw new Error("শুধু Pending অর্ডার এডিট করা যায়");
  const { data: parcel } = await supabase.from("courier_parcels").select("id").eq("order_id", orderId).limit(1).maybeSingle();
  if (parcel) throw new Error("অর্ডারটি কুরিয়ারে পাঠানো হয়েছে — এডিট করা যাবে না");
  return { storeId: store.id as string, order };
}

async function logEdit(context: any, orderId: string, kind: "customer" | "items", before: any, after: any) {
  try {
    const access: any = await resolveStoreAccess(context.supabase, context.userId, context.claims);
    if (!access?.storeId) return;
    const email = context.claims?.email as string | undefined;
    await context.supabase.from("staff_activity_log").insert({
      store_id: access.storeId,
      actor_user_id: access.isOwner ? context.userId : null,
      actor_staff_id: access.staff?.id ?? null,
      actor_name: access.isOwner ? (email ? `Merchant (${email})` : "Merchant (owner)") : (access.staff?.name ?? "Employee"),
      actor_kind: access.isOwner ? "owner" : "employee",
      section: "orders",
      action: kind === "customer" ? "order.customer_edited" : "order.items_edited",
      entity_type: "order",
      entity_id: orderId,
      summary: kind === "customer" ? "Customer info edited" : "Products / charges edited",
      meta: { before, after },
    });
  } catch { /* never block the edit */ }
}

export const listOrderEditHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const store = await myStoreRow(context.supabase, context.userId, "id", "finance");
    if (!store?.id) throw new Error("No store");
    const { data: rows } = await context.supabase.from("staff_activity_log")
      .select("id,actor_name,actor_kind,action,summary,meta,created_at")
      .eq("store_id", store.id).eq("entity_type", "order").eq("entity_id", data.order_id)
      .in("action", ["order.customer_edited", "order.items_edited"])
      .order("created_at", { ascending: false }).limit(50);
    return (rows ?? []) as any[];
  });

async function addTimeline(supabase: any, orderId: string, storeId: string, note: string) {
  try {
    await supabase.from("order_timeline").insert({ order_id: orderId, store_id: storeId, stage: "placed", note });
  } catch { /* timeline is best-effort */ }
}

export const updateOrderCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    order_id: z.string().uuid(),
    customer_name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(6).max(20),
    email: z.string().trim().email().max(200).nullable().or(z.literal("")),
    address: z.string().trim().max(500),
    area: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { storeId } = await loadPendingOrder(context.supabase, context.userId, data.order_id);
    const { data: prev } = await context.supabase.from("orders").select("customer_name,phone,email,address,area,notes").eq("id", data.order_id).maybeSingle();
    const { error } = await context.supabase.from("orders").update({
      customer_name: data.customer_name,
      phone: data.phone,
      email: data.email || null,
      address: data.address,
      area: data.area || null,
      notes: data.notes || null,
    }).eq("id", data.order_id).eq("store_id", storeId);
    if (error) throw new Error(error.message);
    await addTimeline(context.supabase, data.order_id, storeId, "Customer info edited");
    const after = { customer_name: data.customer_name, phone: data.phone, email: data.email || null, address: data.address, area: data.area || null, notes: data.notes || null };
    await logEdit(context, data.order_id, "customer", prev ?? {}, after);
    return { ok: true };
  });

export const listEditableProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await myStoreRow(context.supabase, context.userId, "id", "finance");
    if (!store?.id) throw new Error("No store");
    const { data, error } = await context.supabase.from("products")
      .select("id,name,price,stock,status,product_type,variants,primary_image_url")
      .eq("store_id", store.id).neq("status", "draft").order("name").limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => {
      const items: any[] = Array.isArray(p.variants?.items) ? p.variants.items : [];
      return {
        id: p.id as string, name: p.name as string, price: Number(p.price ?? 0),
        stock: Number(p.stock ?? 0), type: p.product_type as string, image: p.primary_image_url as string | null,
        variants: items.map((v) => ({
          id: String(v.id ?? ""),
          label: String(v.label ?? v.name ?? (v.options && typeof v.options === "object" ? Object.values(v.options).join(" / ") : v.id ?? "")),
          price: v.price != null && Number(v.price) > 0 ? Number(v.price) : Number(p.price ?? 0),
        })).filter((v) => v.label),
      };
    });
  });

export const listOrderDeliveryZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await myStoreRow(context.supabase, context.userId, "id", "finance");
    if (!store?.id) throw new Error("No store");
    const { data, error } = await context.supabase.from("delivery_zones")
      .select("id,name,charge,is_default").eq("store_id", store.id).eq("is_active", true)
      .order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((z: any) => ({ id: z.id as string, name: z.name as string, charge: Number(z.charge ?? 0), is_default: !!z.is_default }));
  });

export const updateOrderItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    order_id: z.string().uuid(),
    items: z.array(z.object({
      product_id: z.string().uuid().nullable(),
      name: z.string().trim().min(1).max(300),
      price: z.number().min(0).max(10_000_000),
      qty: z.number().int().min(1).max(1000),
    })).min(1).max(50),
    delivery_zone_id: z.string().uuid().nullable().optional(),
    discount_amount: z.number().min(0).max(10_000_000),
  }).parse(d))
  .handler(async ({ data: input, context }) => {
    const { storeId, order } = await loadPendingOrder(context.supabase, context.userId, input.order_id);
    // Delivery charge always comes from the merchant's zone — never typed manually.
    let delivery = Number(order.delivery_amount ?? 0);
    let zoneId: string | null | undefined = undefined;
    if (input.delivery_zone_id) {
      const { data: z0 } = await context.supabase.from("delivery_zones").select("id,charge")
        .eq("id", input.delivery_zone_id).eq("store_id", storeId).eq("is_active", true).maybeSingle();
      if (!z0) throw new Error("ডেলিভারি জোন পাওয়া যায়নি");
      delivery = Number(z0.charge ?? 0); zoneId = z0.id;
    }
    const data = { ...input, delivery_amount: delivery };
    const ids = data.items.map((i) => i.product_id).filter(Boolean) as string[];
    if (ids.length) {
      const { data: owned } = await context.supabase.from("products").select("id").eq("store_id", storeId).in("id", ids);
      const ok = new Set((owned ?? []).map((r: any) => r.id));
      if (ids.some((id) => !ok.has(id))) throw new Error("Invalid product");
    }
    const { data: oldItems } = await context.supabase.from("order_items").select("product_id,name_snapshot,price_snapshot,qty").eq("order_id", data.order_id);
    const { error: delErr } = await context.supabase.from("order_items").delete().eq("order_id", data.order_id);
    if (delErr) throw new Error(delErr.message);
    const { error: insErr } = await context.supabase.from("order_items").insert(data.items.map((i) => ({
      order_id: data.order_id, product_id: i.product_id, name_snapshot: i.name, price_snapshot: i.price, qty: i.qty,
    })));
    if (insErr) {
      // restore previous lines so the order is never left empty
      if (oldItems?.length) await context.supabase.from("order_items").insert(oldItems.map((r: any) => ({ ...r, order_id: data.order_id })));
      throw new Error(insErr.message.includes("stock") ? "স্টকে যথেষ্ট পণ্য নেই" : insErr.message);
    }
    const itemsTotal = data.items.reduce((s, i) => s + i.price * i.qty, 0);
    // orders.subtotal stores the grand total (items + delivery − discount)
    const grand = Math.max(itemsTotal + data.delivery_amount - data.discount_amount, 0);
    const { error } = await context.supabase.from("orders").update({
      subtotal: grand, due_amount: Math.max(grand - Number(order.paid_amount ?? 0), 0), delivery_amount: data.delivery_amount, discount_amount: data.discount_amount,
      ...(zoneId !== undefined ? { delivery_zone_id: zoneId } : {}),
    }).eq("id", data.order_id).eq("store_id", storeId);
    if (error) throw new Error(error.message);
    await addTimeline(context.supabase, data.order_id, storeId, "Products / charges edited");
    const fmt = (rows: any[]) => rows.map((r) => ({ name: r.name_snapshot ?? r.name, qty: r.qty, price: Number(r.price_snapshot ?? r.price) }));
    await logEdit(context, data.order_id, "items",
      { items: fmt(oldItems ?? []), delivery: Number(order.delivery_amount ?? 0), discount: Number(order.discount_amount ?? 0) },
      { items: fmt(data.items), delivery: data.delivery_amount, discount: data.discount_amount, total: grand });
    return { ok: true, total: grand };
  });
