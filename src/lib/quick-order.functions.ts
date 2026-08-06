// Quick Order — server side for the Store Admin "Create Order" wizard.
// Lets an owner turn a phone / WhatsApp / Messenger order into a real order
// with the same invoice, stock, timeline and notification behaviour as a
// storefront checkout. Physical products only.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createInput, digits, myStoreId } from "./quick-order.shared";

import type { QuickCustomer } from "./quick-order.shared";
export type { QuickCustomer, QuickOrderInput } from "./quick-order.shared";

/* ------------------------------------------------------------------ */
/* Customer lookup                                                     */
/* ------------------------------------------------------------------ */

/** Live search across store accounts and past order contacts. */
export const searchQuickOrderCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ term: z.string().trim().max(120) }).parse(d))
  .handler(async ({ data, context }): Promise<QuickCustomer[]> => {
    const storeId = await myStoreId(context.supabase, context.userId);
    const term = data.term.trim();
    if (!storeId || term.length < 2) return [];
    const num = digits(term);
    const like = `%${term}%`;

    const filters = [`full_name.ilike.${like}`, `email.ilike.${like}`];
    if (num.length >= 2) filters.push(`phone.ilike.%${num}%`);

    const [{ data: accounts }, { data: orderRows }] = await Promise.all([
      context.supabase
        .from("store_customers")
        .select("id,full_name,email,phone,created_at")
        .eq("store_id", storeId)
        .or(filters.join(","))
        .limit(10),
      context.supabase
        .from("orders")
        .select("id,customer_id,customer_name,phone,email,address,area,delivery_zone_id,subtotal,status,created_at")
        .eq("store_id", storeId)
        .or(
          num.length >= 2
            ? `phone.ilike.%${num}%,customer_name.ilike.${like},email.ilike.${like}`
            : `customer_name.ilike.${like},email.ilike.${like}`,
        )
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    // Exact-id lookup ("customer ID" search).
    let byId: any = null;
    if (/^[0-9a-f-]{36}$/i.test(term)) {
      const { data: row } = await context.supabase
        .from("store_customers")
        .select("id,full_name,email,phone,created_at")
        .eq("store_id", storeId)
        .eq("id", term)
        .maybeSingle();
      byId = row ?? null;
    }

    const all = [...(byId ? [byId] : []), ...((accounts ?? []) as any[])];
    const orders = (orderRows ?? []) as any[];

    const map = new Map<string, QuickCustomer>();
    const push = (c: QuickCustomer) => {
      const key = digits(c.phone) || (c.email ?? "").toLowerCase() || c.id || c.name;
      if (!key || map.has(key)) return;
      map.set(key, c);
    };

    const statsFor = (phone: string, customerId: string | null) => {
      const mine = orders.filter(
        (o) => (customerId && o.customer_id === customerId) || digits(o.phone) === digits(phone),
      );
      const spend = mine
        .filter((o) => o.status !== "cancelled")
        .reduce((a, o) => a + Number(o.subtotal ?? 0), 0);
      const last = mine[0] ?? null;
      return { count: mine.length, spend, last };
    };

    for (const a of all) {
      const st = statsFor(a.phone ?? "", a.id);
      push({
        id: a.id,
        name: a.full_name ?? "",
        phone: a.phone ?? st.last?.phone ?? "",
        email: a.email ?? null,
        address: st.last?.address ?? null,
        area: st.last?.area ?? null,
        deliveryZoneId: st.last?.delivery_zone_id ?? null,
        note: null,
        orders: st.count,
        spend: st.spend,
        lastOrderAt: st.last?.created_at ?? null,
        existing: true,
      });
    }

    for (const o of orders) {
      if (map.size >= 12) break;
      const st = statsFor(o.phone, o.customer_id ?? null);
      push({
        id: o.customer_id ?? null,
        name: o.customer_name ?? "",
        phone: o.phone,
        email: o.email ?? null,
        address: o.address ?? null,
        area: o.area ?? null,
        deliveryZoneId: o.delivery_zone_id ?? null,
        note: null,
        orders: st.count,
        spend: st.spend,
        lastOrderAt: st.last?.created_at ?? null,
        existing: true,
      });
    }

    return Array.from(map.values()).slice(0, 12);
  });

/* ------------------------------------------------------------------ */
/* Customer history panel                                              */
/* ------------------------------------------------------------------ */

export const getQuickOrderCustomerContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ phone: z.string().trim().max(40), customerId: z.string().uuid().nullable().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    const num = digits(data.phone);
    if (!storeId || (!num && !data.customerId)) return null;

    const { data: orderRows } = await context.supabase
      .from("orders")
      .select("id,invoice_no,customer_id,customer_name,phone,email,address,area,delivery_zone_id,status,payment_method,payment_status,subtotal,discount_amount,delivery_amount,created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(400);

    const mine = ((orderRows ?? []) as any[]).filter(
      (o) => digits(o.phone) === num || (data.customerId && o.customer_id === data.customerId),
    );
    const orderIds = mine.map((o) => o.id);

    const [{ data: items }, { data: returns }, { data: noteRow }, { data: addrRows }] = await Promise.all([
      orderIds.length
        ? context.supabase
            .from("order_items")
            .select("order_id,product_id,name_snapshot,price_snapshot,qty")
            .in("order_id", orderIds.slice(0, 200))
        : Promise.resolve({ data: [] as any[] }),
      context.supabase
        .from("returns")
        .select("id,order_id,type,status,created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(60),
      context.supabase
        .from("customer_notes")
        .select("note,tags")
        .eq("store_id", storeId)
        .eq("customer_phone", data.phone)
        .maybeSingle(),
      data.customerId
        ? context.supabase
            .from("store_customer_addresses")
            .select("id,label,name,phone,address,area,is_default")
            .eq("store_id", storeId)
            .eq("customer_id", data.customerId)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const idSet = new Set(orderIds);
    const myReturns = ((returns ?? []) as any[]).filter((r) => r.order_id && idSet.has(r.order_id));

    const active = mine.filter((o) => o.status !== "cancelled");
    const spend = active.reduce((a, o) => a + Number(o.subtotal ?? 0), 0);

    const byOrder = new Map<string, any[]>();
    for (const it of (items ?? []) as any[]) {
      const arr = byOrder.get(it.order_id) ?? [];
      arr.push(it);
      byOrder.set(it.order_id, arr);
    }

    // Recently purchased products (most recent first, de-duplicated).
    const recentProducts: { productId: string; name: string; price: number; qty: number }[] = [];
    const seenP = new Set<string>();
    for (const o of mine) {
      for (const it of byOrder.get(o.id) ?? []) {
        if (!it.product_id || seenP.has(it.product_id)) continue;
        seenP.add(it.product_id);
        recentProducts.push({
          productId: it.product_id,
          name: it.name_snapshot,
          price: Number(it.price_snapshot ?? 0),
          qty: Number(it.qty ?? 1),
        });
        if (recentProducts.length >= 12) break;
      }
      if (recentProducts.length >= 12) break;
    }

    const lastOrder = mine[0] ?? null;

    return {
      stats: {
        orders: mine.length,
        cancelled: mine.filter((o) => o.status === "cancelled").length,
        delivered: mine.filter((o) => o.status === "delivered").length,
        spend,
        aov: active.length ? spend / active.length : 0,
        lastOrderAt: lastOrder?.created_at ?? null,
        returns: myReturns.filter((r) => r.type !== "exchange").length,
        exchanges: myReturns.filter((r) => r.type === "exchange").length,
        vip: spend >= 25000 || mine.length >= 8,
      },
      note: (noteRow as any)?.note ?? null,
      tags: ((noteRow as any)?.tags ?? []) as string[],
      addresses: (addrRows ?? []) as any[],
      orders: mine.slice(0, 8).map((o) => ({
        id: o.id,
        invoice_no: o.invoice_no,
        status: o.status,
        total: Number(o.subtotal ?? 0),
        created_at: o.created_at,
        items: (byOrder.get(o.id) ?? []).map((i: any) => ({
          productId: i.product_id,
          name: i.name_snapshot,
          qty: Number(i.qty ?? 1),
        })),
      })),
      recentProducts,
      returns: myReturns.slice(0, 6),
      lastOrderItems: lastOrder
        ? (byOrder.get(lastOrder.id) ?? []).map((i: any) => ({
            productId: i.product_id,
            name: i.name_snapshot,
            qty: Number(i.qty ?? 1),
          }))
        : [],
    };
  });

/* ------------------------------------------------------------------ */
/* Product search                                                      */
/* ------------------------------------------------------------------ */

export const searchQuickOrderProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        term: z.string().trim().max(120).optional(),
        categoryId: z.string().uuid().nullable().optional(),
        ids: z.array(z.string().uuid()).max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) return { products: [], categories: [] };

    let q = context.supabase
      .from("products")
      .select("id,name,price,old_price,stock,status,sku,product_code,primary_image_url,category_id,variants,delivery_charge")
      .eq("store_id", storeId)
      .eq("product_type", "physical")
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(24);

    if (data.ids?.length) {
      q = context.supabase
        .from("products")
        .select("id,name,price,old_price,stock,status,sku,product_code,primary_image_url,category_id,variants,delivery_charge")
        .eq("store_id", storeId)
        .in("id", data.ids);
    } else {
      const term = (data.term ?? "").trim();
      if (term) {
        const like = `%${term}%`;
        q = q.or(`name.ilike.${like},sku.ilike.${like},product_code.ilike.${like}`);
      }
      if (data.categoryId) q = q.eq("category_id", data.categoryId);
    }

    const [{ data: rows }, { data: cats }] = await Promise.all([
      q,
      context.supabase
        .from("categories")
        .select("id,name")
        .eq("store_id", storeId)
        .order("name")
        .limit(100),
    ]);

    return {
      products: ((rows ?? []) as any[]).map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price ?? 0),
        oldPrice: p.old_price != null ? Number(p.old_price) : null,
        stock: Number(p.stock ?? 0),
        status: p.status as string,
        sku: p.sku ?? p.product_code ?? null,
        image: p.primary_image_url ?? null,
        categoryId: p.category_id ?? null,
        variants: (p.variants ?? { options: [], items: [] }) as any,
      })),
      categories: (cats ?? []) as { id: string; name: string }[],
    };
  });

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export const createQuickOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createInput.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await myStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("No store found for this account");

    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");

    // ---- Trusted product pricing -------------------------------------
    const ids = Array.from(new Set(data.items.map((i) => i.productId)));
    const { data: products, error: pErr } = await sb
      .from("products")
      .select("id,name,price,stock,status,product_type,variants")
      .in("id", ids)
      .eq("store_id", storeId);
    if (pErr) throw new Error(pErr.message);
    const byId = new Map((products ?? []).map((p: any) => [p.id, p]));

    let subtotal = 0;
    const itemRows = data.items.map((i) => {
      const p: any = byId.get(i.productId);
      if (!p) throw new Error("Product not found in this store");
      if (p.product_type !== "physical") throw new Error(`${p.name} is not a physical product`);
      if (p.status === "draft") throw new Error(`${p.name} is not available`);

      // Variant-level price override, when the product defines one.
      let unit = Number(p.price ?? 0);
      const vItems: any[] = Array.isArray(p.variants?.items) ? p.variants.items : [];
      const v = i.variantId ? vItems.find((x) => String(x.id) === i.variantId) : null;
      if (v?.price != null && Number(v.price) > 0) unit = Number(v.price);

      if (!data.allowOversell && Number(p.stock ?? 0) < i.qty) {
        throw new Error(`Not enough stock for ${p.name} (${p.stock} left)`);
      }

      subtotal += unit * i.qty;
      return {
        product_id: p.id,
        name_snapshot: i.variant ? `${p.name} — ${i.variant}` : p.name,
        price_snapshot: unit,
        qty: i.qty,
      };
    });

    // ---- Delivery ------------------------------------------------------
    let zoneId: string | null = null;
    let deliveryAmount = Number(data.deliveryCharge ?? 0);
    if (data.customer.deliveryZoneId) {
      const { data: zone } = await sb
        .from("delivery_zones")
        .select("id,charge,is_active")
        .eq("id", data.customer.deliveryZoneId)
        .eq("store_id", storeId)
        .maybeSingle();
      if (zone && (zone as any).is_active) {
        zoneId = (zone as any).id;
        if (data.deliveryCharge == null) deliveryAmount = Number((zone as any).charge ?? 0);
      }
    }

    // ---- Discount + coupon --------------------------------------------
    let discountAmount = Math.min(Number(data.discount ?? 0), subtotal);
    let couponId: string | null = null;
    if (data.couponCode) {
      const { data: c } = await sb
        .from("coupons")
        .select("id,type,value,min_order,usage_limit,used_count,expires_at,active")
        .eq("store_id", storeId)
        .eq("code", data.couponCode.toUpperCase())
        .maybeSingle();
      const cp: any = c;
      if (
        cp &&
        cp.active &&
        (!cp.expires_at || new Date(cp.expires_at) >= new Date()) &&
        (cp.usage_limit == null || cp.used_count < cp.usage_limit) &&
        subtotal >= Number(cp.min_order ?? 0)
      ) {
        couponId = cp.id;
        if (cp.type === "percent") discountAmount += Math.round((subtotal * Number(cp.value)) / 100);
        else if (cp.type === "fixed") discountAmount += Number(cp.value);
        else if (cp.type === "free_shipping") deliveryAmount = 0;
      } else {
        throw new Error("Coupon is not valid for this order");
      }
    }
    discountAmount = Math.min(discountAmount, subtotal);

    const additional = Number(data.additionalCharge ?? 0);
    const grandTotal = Math.max(0, subtotal + deliveryAmount + additional - discountAmount);

    const paid =
      data.paymentState === "paid"
        ? grandTotal
        : data.paymentState === "partial"
          ? Math.min(Math.max(0, Number(data.paidAmount ?? 0)), grandTotal)
          : 0;
    const due = Math.max(0, grandTotal - paid);

    // ---- Customer: reuse by phone, never duplicate ---------------------
    const phone = data.customer.phone.trim();
    const normPhone = digits(phone);
    const email = (data.customer.email ?? "").trim() || null;

    let customerId: string | null = data.customer.id ?? null;
    if (!customerId && normPhone) {
      const { data: found } = await sb
        .from("store_customers")
        .select("id")
        .eq("store_id", storeId)
        .eq("phone", normPhone)
        .maybeSingle();
      customerId = (found as any)?.id ?? null;
    }
    if (!customerId && email) {
      const { data: found } = await sb
        .from("store_customers")
        .select("id")
        .eq("store_id", storeId)
        .ilike("email", email)
        .maybeSingle();
      customerId = (found as any)?.id ?? null;
    }
    if (customerId) {
      await sb
        .from("store_customers")
        .update({
          full_name: data.customer.name,
          ...(email ? { email } : {}),
          ...(normPhone ? { phone: normPhone } : {}),
        } as any)
        .eq("id", customerId)
        .eq("store_id", storeId);
    } else {
      const { data: created } = await sb
        .from("store_customers")
        .insert({
          store_id: storeId,
          full_name: data.customer.name,
          phone: normPhone || null,
          email,
        } as any)
        .select("id")
        .single();
      customerId = (created as any)?.id ?? null;
    }

    // Optionally remember the address on the customer profile.
    if (customerId && data.customer.saveAddress) {
      const { data: existing } = await sb
        .from("store_customer_addresses")
        .select("id")
        .eq("customer_id", customerId)
        .eq("address", data.customer.address)
        .maybeSingle();
      if (!existing) {
        const { count } = await sb
          .from("store_customer_addresses")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", customerId);
        await sb.from("store_customer_addresses").insert({
          store_id: storeId,
          customer_id: customerId,
          name: data.customer.name,
          phone: normPhone || null,
          address: data.customer.address,
          area: data.customer.area ?? null,
          is_default: (count ?? 0) === 0,
        } as any);
      }
    }

    // ---- Order ---------------------------------------------------------
    const notes = [data.notes, data.customer.note].filter(Boolean).join(" • ") || null;
    const { data: order, error: oErr } = await sb
      .from("orders")
      .insert({
        store_id: storeId,
        customer_id: customerId,
        customer_name: data.customer.name,
        phone,
        email,
        address: data.customer.address,
        area: data.customer.area ?? null,
        payment_method: data.paymentMethod,
        payment_status: data.paymentState === "paid" ? "paid" : "unpaid",
        paid_amount: paid,
        due_amount: due,
        txn_id: data.txnId ?? null,
        notes,
        subtotal: grandTotal,
        delivery_amount: deliveryAmount + additional,
        discount_amount: discountAmount,
        coupon_id: couponId,
        delivery_zone_id: zoneId,
        status: "pending",
        order_type: "physical",
        source: "manual",
        allow_duplicate: true,
      } as any)
      .select("id")
      .single();
    if (oErr || !order) throw new Error(oErr?.message ?? "Could not create the order");

    const { error: iErr } = await sb
      .from("order_items")
      .insert(itemRows.map((r) => ({ ...r, order_id: (order as any).id })));
    if (iErr) throw new Error(iErr.message);

    // Confirming here fires the existing database workflow: invoice number,
    // stock deduction, stock movements, timeline entry and the notification
    // outbox row — exactly the same path a storefront order takes.
    const { error: cErr } = await sb
      .from("orders")
      .update({ status: "confirmed", confirmation_status: "confirmed", confirmed_at: new Date().toISOString() } as any)
      .eq("id", (order as any).id);
    if (cErr) throw new Error(cErr.message);

    if (couponId) {
      await sb.from("coupon_redemptions").insert({
        coupon_id: couponId,
        store_id: storeId,
        order_id: (order as any).id,
        customer_phone: phone,
        discount_amount: discountAmount,
      } as any);
      const { data: c2 } = await sb.from("coupons").select("used_count").eq("id", couponId).maybeSingle();
      if (c2) {
        await sb
          .from("coupons")
          .update({ used_count: ((c2 as any).used_count ?? 0) + 1 } as any)
          .eq("id", couponId);
      }
    }

    // Notifications: confirmation email to the shopper + in-app alert.
    try {
      const { notifyQuickOrder } = await import("@/lib/quick-order.server");
      await notifyQuickOrder(sb as any, (order as any).id);
    } catch {
      /* non-fatal */
    }

    const { data: fresh } = await sb
      .from("orders")
      .select("id,invoice_no,subtotal,paid_amount,due_amount")
      .eq("id", (order as any).id)
      .maybeSingle();

    return {
      orderId: (order as any).id,
      invoiceNo: (fresh as any)?.invoice_no ?? null,
      total: grandTotal,
      paid,
      due,
    };
  });
