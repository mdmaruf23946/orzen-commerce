// Returns & Exchanges — admin state machine.
// Every transition is recorded on return_timeline so the customer sees a live,
// auditable history. Inventory, replacement orders, courier and refunds are all
// driven from here so the merchant only clicks one button per stage.
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPlan } from "@/lib/plan-guard";
import {
  computeReturnAmounts,
  normalizeAutoWorkflow,
  normalizePolicy,
  type ReturnKind,
} from "@/lib/returns-pricing";

async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const data = await myStoreRow(supabase, userId, "id", "returns");
  return (data as any)?.id ?? null;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadRequest(sb: any, sid: string, id: string) {
  const { data } = await sb.from("returns").select("*").eq("id", id).eq("store_id", sid).maybeSingle();
  if (!data) throw new Error("Request not found");
  return data as any;
}

async function log(sb: any, r: any, status: string, note?: string | null) {
  await sb.from("return_timeline").insert({
    return_id: r.id,
    store_id: r.store_id,
    status,
    note: note ?? null,
    actor: "store",
  } as any);
}

// ---------- SETTINGS ----------
export const getReturnSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return null;
    const { data } = await context.supabase
      .from("store_return_settings")
      .select("*")
      .eq("store_id", sid)
      .maybeSingle();
    const row = (data ?? {}) as any;
    return {
      store_id: sid,
      ...normalizePolicy(data),
      ...row,
      exchange_rules: normalizePolicy(data).exchange_rules,
      auto_workflow: normalizeAutoWorkflow(row.auto_workflow),
      refund_methods: row.refund_methods ?? ["original", "store_credit", "manual"],
      require_admin_approval: row.require_admin_approval !== false,
      require_courier_tracking: !!row.require_courier_tracking,
    };
  });

const shippingMode = z.enum(["customer", "store", "split", "free"]);

const settingsSchema = z.object({
  enabled: z.boolean(),
  eligibility_days: z.number().int().min(0).max(365),
  exchange_window_days: z.number().int().min(0).max(365),
  allow_return: z.boolean(),
  allow_exchange_same: z.boolean(),
  allow_exchange_other: z.boolean(),
  return_shipping_payer: z.enum(["store", "customer"]),
  return_shipping_charge: z.number().nonnegative().max(100000),
  replacement_shipping_payer: z.enum(["store", "customer"]),
  replacement_shipping_charge: z.number().nonnegative().max(100000),
  return_shipping_mode: shippingMode,
  return_split_customer: z.number().nonnegative().max(100000),
  return_split_store: z.number().nonnegative().max(100000),
  replacement_shipping_mode: shippingMode,
  replacement_split_customer: z.number().nonnegative().max(100000),
  replacement_split_store: z.number().nonnegative().max(100000),
  restocking_fee_type: z.enum(["none", "percent", "flat"]),
  restocking_fee_value: z.number().nonnegative().max(100000),
  exchange_rules: z.object({
    same_variant: z.boolean(),
    different_variant: z.boolean(),
    different_product: z.boolean(),
    higher_price: z.boolean(),
    lower_price: z.boolean(),
    equal_price: z.boolean(),
  }),
  replacement_source: z.enum(["cart", "wishlist", "all"]),
  customer_pays_difference: z.boolean(),
  refund_direction: z.enum(["refund_bank", "store_credit", "no_refund"]),
  refund_methods: z.array(z.enum(["original", "store_credit", "manual", "cod_adjust"])).max(6),
  require_admin_approval: z.boolean(),
  require_inspection: z.boolean(),
  require_photo: z.boolean(),
  require_courier_tracking: z.boolean(),
  auto_workflow: z.object({
    return_courier: z.boolean(),
    replacement_order: z.boolean(),
    reserve_stock: z.boolean(),
    update_inventory: z.boolean(),
    notify_customer: z.boolean(),
    sync_tracking: z.boolean(),
  }),
  auto_approve_under: z.number().nonnegative().max(1_000_000).nullable().optional(),
  policy_note: z.string().max(2000).nullable().optional(),
});


export const saveReturnSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const { error } = await context.supabase
      .from("store_return_settings")
      .upsert({ store_id: sid, ...data } as any, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    await (await import("@/lib/store-cache-bust.server")).bustStoreCaches(sid);
    return { ok: true };
  });

// ---------- LIST ----------
export const listReturnRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    const { data } = await context.supabase
      .from("returns")
      .select(
        "*, orders!returns_order_id_fkey(customer_name,phone,address,area,invoice_no,order_type,payment_method,payment_status,subtotal,delivery_amount), return_items(*), return_timeline(status,note,actor,created_at)",
      )
      .eq("store_id", sid)
      .order("created_at", { ascending: false });
    const rows = ((data ?? []) as any[]).map((r) => ({
      ...r,
      lines: (r.return_items ?? []).map((i: any) => ({
        id: i.id,
        product_id: i.product_id,
        order_item_id: i.order_item_id,
        name: i.name,
        variant: i.variant,
        qty: i.qty,
        price: Number(i.unit_price ?? 0),
        image: i.image_url,
        inspection_result: i.inspection_result,
      })),
      timeline: (r.return_timeline ?? []).sort(
        (a: any, b: any) => +new Date(a.created_at) - +new Date(b.created_at),
      ),
    }));
    return rows;
  });

// ---------- ACTIONS ----------
const actionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum([
    "approve",
    "reject",
    "create_shipment",
    "mark_in_transit",
    "mark_received",
    "inspect",
    "create_replacement",
    "process_refund",
    "refund_pending",
    "reject_refund",
    "complete",
    "cancel",
  ]),
  note: z.string().max(1500).optional(),
  courier_name: z.string().max(120).optional(),
  courier_tracking_id: z.string().max(160).optional(),
  inspection: z.enum(["passed", "failed"]).optional(),
  restock: z.boolean().optional(),
  refund_method: z.enum(["original", "store_credit", "manual", "cod_adjust"]).optional(),
  refund_amount: z.number().nonnegative().max(10_000_000).optional(),
  dispatch_courier: z.boolean().optional(),
});

export const runReturnAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => actionSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "returns");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const sb = await admin();
    const r = await loadRequest(sb, sid, data.id);
    const { data: settingsRow } = await sb
      .from("store_return_settings")
      .select("auto_workflow")
      .eq("store_id", sid)
      .maybeSingle();
    const auto = normalizeAutoWorkflow((settingsRow as any)?.auto_workflow);



    const patch: Record<string, any> = {};
    let nextStatus: string | null = null;
    let timelineStatus: string | null = null;
    let extra: Record<string, any> = {};

    switch (data.action) {
      case "approve": {
        if (!["requested"].includes(r.status)) throw new Error("Only pending requests can be approved");
        nextStatus = "approved";
        break;
      }
      case "reject": {
        if (!["requested", "approved"].includes(r.status)) throw new Error("Cannot reject at this stage");
        nextStatus = "rejected";
        break;
      }
      case "cancel": {
        nextStatus = "cancelled";
        break;
      }
      case "create_shipment": {
        if (!["approved", "shipment_created"].includes(r.status))
          throw new Error("Approve the request first");
        patch["courier_name"] = data.courier_name || r.courier_name || null;
        patch["courier_tracking_id"] = data.courier_tracking_id || r.courier_tracking_id || null;
        nextStatus = "shipment_created";
        break;
      }
      case "mark_in_transit": {
        nextStatus = "in_transit";
        break;
      }
      case "mark_received": {
        nextStatus = "received";
        patch["received_at"] = new Date().toISOString();
        break;
      }
      case "inspect": {
        if (!["received", "in_transit", "shipment_created"].includes(r.status))
          throw new Error("Mark the parcel received first");
        const passed = data.inspection === "passed";
        nextStatus = passed ? "inspection_passed" : "inspection_failed";
        patch["inspected_at"] = new Date().toISOString();
        patch["inspection_note"] = data.note ?? null;
        await sb
          .from("return_items")
          .update({ inspection_result: passed ? "passed" : "failed" } as any)
          .eq("return_id", r.id);

        // Inventory moves only after a successful inspection.
        if (passed && data.restock !== false && auto.update_inventory !== false) {
          const { data: lines } = await sb
            .from("return_items")
            .select("id,product_id,qty,restocked_qty")
            .eq("return_id", r.id);
          for (const l of ((lines ?? []) as any[])) {
            if (!l.product_id || Number(l.restocked_qty ?? 0) >= Number(l.qty ?? 0)) continue;
            const { data: p } = await sb
              .from("products")
              .select("id,stock,product_type")
              .eq("id", l.product_id)
              .maybeSingle();
            if (!p || (p as any).product_type !== "physical") continue;
            const add = Number(l.qty ?? 0);
            await sb
              .from("products")
              .update({ stock: Number((p as any).stock ?? 0) + add } as any)
              .eq("id", l.product_id);
            await sb.from("stock_movements").insert({
              store_id: sid,
              product_id: l.product_id,
              delta: add,
              type: "return",
              ref_order_id: r.order_id,
              reason: `Return ${r.id.slice(0, 8)} inspected`,
            } as any);
            await sb.from("return_items").update({ restocked_qty: add } as any).eq("id", l.id);
          }
        }
        break;
      }
      case "create_replacement": {
        if (r.request_kind === "return") throw new Error("This is a refund-only request");
        if (r.replacement_order_id) throw new Error("Replacement order already exists");
        if (!["inspection_passed", "received", "approved"].includes(r.status))
          throw new Error("Complete the inspection first");

        const items = Array.isArray(r.replacement_items) ? r.replacement_items : [];
        if (!items.length) throw new Error("No replacement items on this request");

        const { data: order } = await sb
          .from("orders")
          .select("customer_name,phone,address,area,email,customer_id,payment_method,delivery_zone_id")
          .eq("id", r.order_id)
          .maybeSingle();

        const subtotal = items.reduce(
          (s: number, i: any) => s + Number(i.price ?? 0) * Number(i.qty ?? 1),
          0,
        );
        const { data: newOrder, error: oErr } = await sb
          .from("orders")
          .insert({
            store_id: sid,
            customer_name: (order as any)?.customer_name ?? r.customer_name ?? "Customer",
            phone: (order as any)?.phone ?? r.phone ?? "",
            address: (order as any)?.address ?? "",
            area: (order as any)?.area ?? null,
            email: (order as any)?.email ?? null,
            customer_id: (order as any)?.customer_id ?? r.customer_id ?? null,
            payment_method: Number(r.extra_payment_due ?? 0) > 0 ? "cod" : "cod",
            payment_status: Number(r.extra_payment_due ?? 0) > 0 ? "unpaid" : "paid",
            subtotal,
            discount_amount: subtotal, // replacement is not re-charged; customer pays only the difference
            delivery_amount: Number(r.replacement_shipping_charge ?? 0),
            status: "pending",
            order_type: "physical",
            source: "return_exchange",
            notes: `Replacement for return ${r.id.slice(0, 8)} (order ${r.order_id.slice(0, 8)})`,
          } as any)
          .select("id,invoice_no")
          .maybeSingle();
        if (oErr) throw new Error(oErr.message);

        await sb.from("order_items").insert(
          items.map((i: any) => ({
            order_id: (newOrder as any).id,
            product_id: i.product_id ?? null,
            name_snapshot: i.name,
            price_snapshot: Number(i.price ?? 0),
            qty: Number(i.qty ?? 1),
          })) as any,
        );

        // Confirming through an UPDATE lets the order trigger deduct stock and
        // mint the invoice number exactly like a normal sale.
        await sb.from("orders").update({ status: "confirmed" } as any).eq("id", (newOrder as any).id);


        patch["replacement_order_id"] = (newOrder as any).id;
        nextStatus = "replacement_created";
        extra = { replacement_order_id: (newOrder as any).id };

        // Courier label + tracking for the replacement shipment.
        if (data.dispatch_courier ?? auto.return_courier) {
          try {
            const { dispatchParcel } = await import("@/lib/courier-parcels.functions");
            const { data: store } = await sb
              .from("stores")
              .select("id,couriers")
              .eq("id", sid)
              .maybeSingle();
            await dispatchParcel(sb, store as any, { orderId: (newOrder as any).id });
          } catch (e) {
            extra["courier_error"] = (e as Error).message;
          }
        }
        break;
      }
      case "process_refund": {
        const amount = Number(data.refund_amount ?? r.refund_amount ?? 0);
        patch["refund_amount"] = amount;
        patch["refund_method"] = data.refund_method ?? r.refund_method ?? "manual";
        patch["refund_status"] = "paid";
        patch["refund_processed_at"] = new Date().toISOString();
        nextStatus = "refunded";
        break;
      }
      case "refund_pending": {
        patch["refund_amount"] = Number(data.refund_amount ?? r.refund_amount ?? 0);
        patch["refund_method"] = data.refund_method ?? r.refund_method ?? "manual";
        patch["refund_status"] = "pending";
        timelineStatus = "refund_pending";
        break;
      }
      case "reject_refund": {
        patch["refund_status"] = "rejected";
        timelineStatus = "refund_rejected";
        break;
      }
      case "complete": {
        nextStatus = "completed";
        break;
      }
    }

    if (data.note && data.action !== "inspect") patch["resolution_note"] = data.note;
    if (nextStatus) patch["status"] = nextStatus;

    const { error } = await sb.from("returns").update(patch as any).eq("id", r.id).eq("store_id", sid);
    if (error) throw new Error(error.message);
    const logged = nextStatus ?? timelineStatus;
    if (logged) {
      await log(sb, r, logged, data.note ?? null);
      const { notifyReturnStatus } = await import("@/lib/returns-notify.server");
      await notifyReturnStatus(sb, { ...r, ...patch }, logged, data.note ?? null, {
        notifyCustomer: auto.notify_customer !== false,
      });
    }

    return { id: r.id, status: nextStatus ?? r.status, ...extra };
  });

/** Recalculate the money for a request after the merchant tweaks charges. */
export const repriceReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        return_shipping_charge: z.number().nonnegative().max(100000),
        replacement_shipping_charge: z.number().nonnegative().max(100000),
        restocking_fee: z.number().nonnegative().max(100000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "returns");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const sb = await admin();
    const r = await loadRequest(sb, sid, data.id);

    const lines = (
      (await sb.from("return_items").select("qty,unit_price").eq("return_id", r.id)).data ?? []
    ).map((l: any) => ({ name: "", qty: Number(l.qty), price: Number(l.unit_price) }));
    const replacements = (Array.isArray(r.replacement_items) ? r.replacement_items : []).map(
      (i: any) => ({ name: i.name, qty: Number(i.qty ?? 1), price: Number(i.price ?? 0) }),
    );

    const amounts = computeReturnAmounts(
      normalizePolicy({
        return_shipping_payer: "customer",
        replacement_shipping_payer: "customer",
        return_shipping_mode: "customer",
        replacement_shipping_mode: "customer",

        return_shipping_charge: data.return_shipping_charge,
        replacement_shipping_charge: data.replacement_shipping_charge,
        restocking_fee_type: "flat",
        restocking_fee_value: data.restocking_fee,
      }),
      (r.request_kind ?? "return") as ReturnKind,
      lines as any,
      replacements as any,
    );

    const { error } = await sb
      .from("returns")
      .update({
        return_shipping_charge: amounts.return_shipping_charge,
        replacement_shipping_charge: amounts.replacement_shipping_charge,
        restocking_fee: amounts.restocking_fee,
        items_value: amounts.items_value,
        replacement_value: amounts.replacement_value,
        refund_amount: amounts.refund_amount,
        extra_payment_due: amounts.extra_payment_due,
      } as any)
      .eq("id", r.id)
      .eq("store_id", sid);
    if (error) throw new Error(error.message);
    return amounts;
  });

/**
 * Per-request override switch. Turning it back on re-applies the store's global
 * return settings to this request's money; turning it off keeps the manual
 * charges the merchant entered on the request.
 */
export const setReturnUseGlobal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), use_global: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "returns");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const sb = await admin();
    const r = await loadRequest(sb, sid, data.id);

    const patch: Record<string, any> = { use_global_settings: data.use_global };

    if (data.use_global) {
      const { data: settings } = await sb
        .from("store_return_settings")
        .select("*")
        .eq("store_id", sid)
        .maybeSingle();
      const policy = normalizePolicy(settings);
      const lines = (
        (await sb.from("return_items").select("qty,unit_price").eq("return_id", r.id)).data ?? []
      ).map((l: any) => ({ name: "", qty: Number(l.qty), price: Number(l.unit_price) }));
      const replacements = (Array.isArray(r.replacement_items) ? r.replacement_items : []).map(
        (i: any) => ({ name: i.name, qty: Number(i.qty ?? 1), price: Number(i.price ?? 0) }),
      );
      const amounts = computeReturnAmounts(
        policy,
        (r.request_kind ?? "return") as ReturnKind,
        lines as any,
        replacements as any,
      );
      Object.assign(patch, amounts, {
        refund_amount: amounts.refund_amount,
        extra_payment_due: amounts.extra_payment_due,
      });
      delete (patch as any).items_value;
      patch["items_value"] = amounts.items_value;
    }

    const { error } = await sb.from("returns").update(patch as any).eq("id", r.id).eq("store_id", sid);
    if (error) throw new Error(error.message);
    return { ok: true, use_global: data.use_global };
  });

// ---------- MANUAL CREATION ----------

/** Order lookup for the manual return wizard: order id, invoice no or phone. */
export const searchOrdersForReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().trim().max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "returns");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    const sb = await admin();
    const q = data.q.trim();

    let query = sb
      .from("orders")
      .select(
        "id,invoice_no,customer_name,phone,status,order_type,created_at,subtotal,delivery_amount,discount_amount,customer_id,order_items(id,product_id,name_snapshot,price_snapshot,qty)",
      )
      .eq("store_id", sid)
      .eq("order_type", "physical")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(15);

    if (q) {
      const digits = q.replace(/[^0-9]/g, "");
      const ors = [`invoice_no.ilike.%${q}%`];
      if (digits.length >= 4) ors.push(`phone.ilike.%${digits}%`);
      if (/^[0-9a-f-]{6,}$/i.test(q)) ors.push(`id.eq.${q}`);
      query = query.or(ors.join(","));
    }

    const { data: rows } = await query;
    const ids = ((rows ?? []) as any[]).flatMap((o) =>
      (o.order_items ?? []).map((i: any) => i.product_id).filter(Boolean),
    );
    const imageById = new Map<string, string | null>();
    if (ids.length) {
      const { data: prods } = await sb
        .from("products")
        .select("id,primary_image_url,gallery")
        .in("id", Array.from(new Set(ids)));
      for (const p of ((prods ?? []) as any[])) {
        imageById.set(
          p.id,
          p.primary_image_url ?? (Array.isArray(p.gallery) ? (p.gallery[0] ?? null) : null),
        );
      }
    }

    // Units already claimed by earlier requests, so the merchant cannot over-return.
    const orderIds = ((rows ?? []) as any[]).map((o) => o.id);
    const used = new Map<string, number>();
    if (orderIds.length) {
      const { data: claimed } = await sb
        .from("return_items")
        .select("order_item_id,qty, returns!inner(order_id,status)")
        .in("returns.order_id", orderIds);
      for (const c of ((claimed ?? []) as any[])) {
        if (["rejected", "cancelled"].includes(c.returns?.status ?? "")) continue;
        if (!c.order_item_id) continue;
        used.set(c.order_item_id, (used.get(c.order_item_id) ?? 0) + Number(c.qty ?? 0));
      }
    }

    return ((rows ?? []) as any[]).map((o) => ({
      id: o.id,
      invoice_no: o.invoice_no,
      customer_name: o.customer_name,
      phone: o.phone,
      customer_id: o.customer_id,
      status: o.status,
      created_at: o.created_at,
      total:
        Number(o.subtotal ?? 0) + Number(o.delivery_amount ?? 0) - Number(o.discount_amount ?? 0),
      items: (o.order_items ?? []).map((i: any) => ({
        order_item_id: i.id,
        product_id: i.product_id,
        name: i.name_snapshot,
        price: Number(i.price_snapshot ?? 0),
        qty: Number(i.qty ?? 1),
        returnable_qty: Math.max(0, Number(i.qty ?? 1) - (used.get(i.id) ?? 0)),
        image_url: i.product_id ? (imageById.get(i.product_id) ?? null) : null,
      })),
    }));
  });

/** In-stock catalogue for picking a replacement product manually. */
export const listReplacementProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().trim().max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    const sb = await admin();
    let q = sb
      .from("products")
      .select("id,name,price,stock,primary_image_url,gallery")
      .eq("store_id", sid)
      .eq("product_type", "physical")
      .eq("status", "active")
      .order("name")
      .limit(40);
    if (data.q) q = q.ilike("name", `%${data.q}%`);
    const { data: rows } = await q;
    return ((rows ?? []) as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price ?? 0),
      stock: Number(p.stock ?? 0),
      image_url: p.primary_image_url ?? (Array.isArray(p.gallery) ? (p.gallery[0] ?? null) : null),
    }));
  });

const manualLine = z.object({
  order_item_id: z.string().uuid(),
  qty: z.number().int().min(1).max(999),
  variant: z.string().max(120).nullable().optional(),
});

const manualReplacement = z.object({
  product_id: z.string().uuid(),
  qty: z.number().int().min(1).max(999),
  variant: z.string().max(120).nullable().optional(),
});

const manualArgs = z.object({
  order_id: z.string().uuid(),
  kind: z.enum(["return", "exchange_same", "exchange_other"]),
  reason: z.string().trim().max(600).optional(),
  internal_note: z.string().trim().max(1000).optional(),
  customer_note: z.string().trim().max(1000).optional(),
  lines: z.array(manualLine).min(1).max(30),
  replacements: z.array(manualReplacement).max(30).default([]),
  use_global: z.boolean().default(true),
  charges: z
    .object({
      return_shipping_charge: z.number().nonnegative().max(100000),
      replacement_shipping_charge: z.number().nonnegative().max(100000),
      restocking_fee: z.number().nonnegative().max(100000),
      manual_adjustment: z.number().min(-1_000_000).max(1_000_000),
    })
    .default({
      return_shipping_charge: 0,
      replacement_shipping_charge: 0,
      restocking_fee: 0,
      manual_adjustment: 0,
    }),
});

/**
 * Store-admin created request. Always attached to a real order and its existing
 * customer — no new customer or order rows are created here.
 */
export const createManualReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => manualArgs.parse(d))
  .handler(async ({ data, context }) => {
    await assertPlan(context.supabase, context.userId, "returns");
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) throw new Error("No store");
    const sb = await admin();

    const { data: order } = await sb
      .from("orders")
      .select("id,store_id,customer_id,customer_name,phone,status")
      .eq("id", data.order_id)
      .eq("store_id", sid)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    if ((order as any).status === "cancelled") throw new Error("Cancelled orders are not eligible");

    const { data: items } = await sb
      .from("order_items")
      .select("id,product_id,name_snapshot,price_snapshot,qty")
      .eq("order_id", data.order_id);
    const byId = new Map(((items ?? []) as any[]).map((i) => [i.id, i]));

    const productIds = ((items ?? []) as any[]).map((i) => i.product_id).filter(Boolean);
    const imageById = new Map<string, string | null>();
    if (productIds.length) {
      const { data: prods } = await sb
        .from("products")
        .select("id,primary_image_url,gallery")
        .in("id", Array.from(new Set(productIds)));
      for (const p of ((prods ?? []) as any[])) {
        imageById.set(
          p.id,
          p.primary_image_url ?? (Array.isArray(p.gallery) ? (p.gallery[0] ?? null) : null),
        );
      }
    }

    const lines = data.lines.map((l) => {
      const src = byId.get(l.order_item_id);
      if (!src) throw new Error("Invalid item in request");
      return {
        order_item_id: src.id,
        product_id: src.product_id,
        name: src.name_snapshot,
        variant: l.variant ?? null,
        qty: Math.min(Number(l.qty), Number(src.qty ?? 1)),
        price: Number(src.price_snapshot ?? 0),
        image_url: src.product_id ? (imageById.get(src.product_id) ?? null) : null,
      };
    });

    const replacements: any[] = [];
    if (data.kind !== "return") {
      for (const r of data.replacements) {
        const { data: p } = await sb
          .from("products")
          .select("id,name,price,primary_image_url,gallery")
          .eq("id", r.product_id)
          .eq("store_id", sid)
          .maybeSingle();
        if (!p) throw new Error("Replacement product unavailable");
        replacements.push({
          product_id: (p as any).id,
          name: (p as any).name,
          variant: r.variant ?? null,
          qty: Number(r.qty),
          price: Number((p as any).price ?? 0),
          image_url:
            (p as any).primary_image_url ??
            (Array.isArray((p as any).gallery) ? ((p as any).gallery[0] ?? null) : null),
        });
      }
      if (!replacements.length) throw new Error("Pick a replacement product");
    }

    const { data: settings } = await sb
      .from("store_return_settings")
      .select("*")
      .eq("store_id", sid)
      .maybeSingle();

    const policy = data.use_global
      ? normalizePolicy(settings)
      : normalizePolicy({
          return_shipping_mode: "customer",
          replacement_shipping_mode: "customer",
          return_shipping_charge: data.charges.return_shipping_charge,
          replacement_shipping_charge: data.charges.replacement_shipping_charge,
          restocking_fee_type: "flat",
          restocking_fee_value: data.charges.restocking_fee,
        });

    const amounts = computeReturnAmounts(
      policy,
      data.kind as ReturnKind,
      lines as any,
      replacements as any,
    );

    // A positive adjustment reduces the refund / increases what the customer owes.
    const adj = Number(data.charges.manual_adjustment ?? 0);
    let net = amounts.refund_amount - amounts.extra_payment_due - adj;
    const refund_amount = net > 0 ? Math.round(net * 100) / 100 : 0;
    const extra_payment_due = net < 0 ? Math.round(-net * 100) / 100 : 0;

    const { data: inserted, error } = await sb
      .from("returns")
      .insert({
        store_id: sid,
        order_id: data.order_id,
        customer_id: (order as any).customer_id ?? null,
        customer_name: (order as any).customer_name ?? null,
        phone: (order as any).phone ?? null,
        type: data.kind === "return" ? "return" : "exchange",
        request_kind: data.kind,
        status: "requested",
        reason: data.reason ?? null,
        customer_note: data.customer_note ?? null,
        internal_note: data.internal_note ?? null,
        created_by: "admin",
        use_global_settings: data.use_global,
        manual_adjustment: adj,
        items: lines as any,
        replacement_items: replacements as any,
        replacement_product_id: replacements[0]?.product_id ?? null,
        items_value: amounts.items_value,
        replacement_value: amounts.replacement_value,
        return_shipping_charge: amounts.return_shipping_charge,
        replacement_shipping_charge: amounts.replacement_shipping_charge,
        restocking_fee: amounts.restocking_fee,
        refund_amount,
        extra_payment_due,
        images: [],
      } as any)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const ret = inserted as any;

    await sb.from("return_items").insert(
      lines.map((l) => ({
        return_id: ret.id,
        store_id: sid,
        order_item_id: l.order_item_id,
        product_id: l.product_id,
        name: l.name,
        variant: l.variant,
        qty: l.qty,
        unit_price: l.price,
        image_url: l.image_url,
      })) as any,
    );

    await log(sb, ret, "requested", data.reason ?? "Created by merchant panel");
    const { notifyReturnStatus } = await import("@/lib/returns-notify.server");
    await notifyReturnStatus(sb, ret, "requested", data.reason ?? null, {
      notifyCustomer: normalizeAutoWorkflow((settings as any)?.auto_workflow).notify_customer !== false,
    });

    return { id: ret.id as string, refund_amount, extra_payment_due };
  });
