// Courier parcel management — authenticated store-owner server functions.
// Frontend is unified; provider differences live in src/lib/couriers/*.server.ts
import { collectAmount } from "@/lib/couriers/collect-amount";
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertPlan } from "@/lib/plan-guard";
import {
  ACTIVE_STATUSES,
  PARCEL_STATUSES,
  buildTrackingUrl,
  isManualCourier,
} from "@/lib/couriers/status";

const COURIER_KEYS = [
  "steadfast",
  "pathao",
  "redx",
  "paperfly",
  "ecourier",
  "sa_paribahan",
  "sundarban",
] as const;

const uuid = z.string().uuid();

export const listParcels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        courierKey: z.enum(COURIER_KEYS).optional(),
        status: z.enum(PARCEL_STATUSES).optional(),
        statuses: z.array(z.enum(PARCEL_STATUSES)).max(12).optional(),
        excludeStatuses: z.array(z.enum(PARCEL_STATUSES)).max(12).optional(),
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).max(100000).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await getStore(supabase, userId);
    let q = supabase
      .from("courier_parcels")
      .select("*", { count: "exact" })
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .range(data.offset ?? 0, (data.offset ?? 0) + (data.limit ?? 25) - 1);
    if (data.courierKey) q = q.eq("courier_key", data.courierKey);
    if (data.status) q = q.eq("status", data.status);
    if (data.statuses?.length) q = q.in("status", data.statuses);
    if (data.excludeStatuses?.length)
      q = q.not("status", "in", `(${data.excludeStatuses.join(",")})`);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(
        `tracking_code.ilike.${s},consignment_id.ilike.${s},recipient_name.ilike.${s},recipient_phone.ilike.${s}`,
      );
    }
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });

/** Status chip counts for the dashboard tabs. */
export const parcelStatusCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ courierKey: z.enum(COURIER_KEYS).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const store = await getStore(context.supabase, context.userId);
    let q = context.supabase.from("courier_parcels").select("status").eq("store_id", store.id);
    if (data.courierKey) q = q.eq("courier_key", data.courierKey);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const r of rows ?? []) counts[(r as any).status] = (counts[(r as any).status] ?? 0) + 1;
    return counts;
  });

export const getParcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await getStore(supabase, userId);
    const { data: parcel } = await supabase
      .from("courier_parcels")
      .select("*")
      .eq("id", data.id)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!parcel) throw new Error("Parcel not found");
    const { data: events } = await supabase
      .from("courier_parcel_events")
      .select("id,status,message,source,created_at")
      .eq("parcel_id", data.id)
      .order("created_at", { ascending: true });
    const { data: logs } = await supabase
      .from("courier_api_logs")
      .select("id,action,endpoint,method,http_status,duration_ms,ok,error,request,response,created_at")
      .eq("parcel_id", data.id)
      .order("created_at", { ascending: false })
      .limit(30);
    return { parcel, events: events ?? [], logs: logs ?? [] };
  });

/** Orders that are confirmed/processing and have no parcel yet. */
export const listSendableOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await getStore(supabase, userId);
    const { data: parcels } = await supabase
      .from("courier_parcels")
      .select("order_id")
      .eq("store_id", store.id)
      .not("status", "in", "(cancelled,failed)");
    const used = new Set((parcels ?? []).map((p: any) => p.order_id).filter(Boolean));
    const { data: orders } = await supabase
      .from("orders")
      .select(
        "id,invoice_no,customer_name,phone,address,area,subtotal,paid_amount,delivery_amount,discount_amount,payment_method,payment_status,status,created_at",
      )
      .eq("store_id", store.id)
      .eq("status", "processing")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    const list = (orders ?? []).filter((o: any) => !used.has(o.id));
    if (!list.length) return [];
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id,name_snapshot,price_snapshot,qty,products(primary_image_url)")
      .in(
        "order_id",
        list.map((o: any) => o.id),
      );
    const byOrder: Record<string, Array<{ name: string; qty: number; price: number; image: string | null }>> = {};
    for (const i of items ?? []) {
      const row = i as any;
      const rawImg = row.products?.primary_image_url as string | null | undefined;
      (byOrder[row.order_id] ??= []).push({
        name: row.name_snapshot,
        qty: row.qty,
        price: Number(row.price_snapshot ?? 0),
        image: rawImg ? (rawImg.startsWith("http") || rawImg.startsWith("/") ? rawImg : `/api/img/${rawImg}`) : null,
      });
    }
    const defaultKey = defaultCourier(store);
    return list.map((o: any) => {
      const total = Math.max(0, Number(o.subtotal ?? 0));
      const cod = collectAmount(o);
      return {
        ...o,
        items: byOrder[o.id] ?? [],
        total,
        cod_amount: cod,
        courier_key: defaultKey,
      };
    });
  });

/** Connected courier summary for the Courier Orders header + send dialog. */
export const getCourierOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await getStore(context.supabase, context.userId);
    const all = (store.couriers ?? {}) as Record<string, any>;
    const couriers = COURIER_KEYS.filter((k) => all[k]?.enabled).map((k) => ({
      key: k,
      isDefault: !!all[k]?.is_default,
      sandbox: !!all[k]?.sandbox,
      pickup: all[k]?.pickup ?? {},
      shipping: all[k]?.shipping ?? {},
      manual: isManualCourier(k),
    }));
    return { defaultKey: defaultCourier(store), couriers };
  });

/** Pick the merchant's Default Courier (only one; must be connected). null clears it. */
export const setDefaultCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ courierKey: z.enum(COURIER_KEYS).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    const all = { ...((store.couriers ?? {}) as Record<string, any>) };
    if (data.courierKey && !all[data.courierKey]?.enabled) throw new Error("এই কুরিয়ারটি কানেক্ট করা নেই");
    for (const k of Object.keys(all)) all[k] = { ...(all[k] ?? {}), is_default: k === data.courierKey };
    const { error } = await supabase.from("stores").update({ couriers: all } as never).eq("id", store.id);
    if (error) throw new Error(error.message);
    return { ok: true, defaultKey: data.courierKey };
  });

/** One-click: build the parcel from an order and push it to the courier. */
export const sendOrderToCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: uuid,
        courierKey: z.enum(COURIER_KEYS).optional(),
        weight: z.number().finite().min(0).max(1000).optional(),
        deliveryType: z.string().trim().max(40).optional(),
        note: z.string().trim().max(500).optional(),
        codAmount: z.number().finite().min(0).max(10000000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    const note = [data.deliveryType ? `Delivery: ${data.deliveryType}` : null, data.note || null]
      .filter(Boolean)
      .join(" · ");
    return dispatchParcel(supabase, store, {
      orderId: data.orderId,
      courierKey: data.courierKey,
      weight: data.weight,
      note: note || undefined,
      codAmount: data.codAmount,
    });
  });

/** Refresh every still-moving parcel (the "Sync Now" button). */
export const syncActiveParcels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ courierKey: z.enum(COURIER_KEYS).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    let q = supabase
      .from("courier_parcels")
      .select("id")
      .eq("store_id", store.id)
      .in("status", ACTIVE_STATUSES)
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(50);
    if (data.courierKey) q = q.eq("courier_key", data.courierKey);
    const { data: rows } = await q;
    let updated = 0;
    for (const r of rows ?? []) {
      try {
        if (await syncOne(supabase, store, (r as any).id)) updated += 1;
      } catch {
        /* per-parcel failures are recorded on the parcel row */
      }
    }
    return { checked: (rows ?? []).length, updated };
  });


const draftSchema = z.object({
  id: uuid.optional(),
  orderId: uuid.optional().nullable(),
  courierKey: z.enum(COURIER_KEYS),
  recipientName: z.string().trim().min(1).max(120),
  recipientPhone: z.string().trim().min(6).max(30),
  recipientAddress: z.string().trim().min(3).max(500),
  recipientCity: z.string().trim().max(80).optional().nullable(),
  recipientZone: z.string().trim().max(80).optional().nullable(),
  recipientArea: z.string().trim().max(80).optional().nullable(),
  codAmount: z.number().finite().min(0).max(10000000),
  deliveryCharge: z.number().finite().min(0).max(1000000).optional(),
  weight: z.number().finite().min(0).max(1000).optional().nullable(),
  dimensions: z.string().trim().max(80).optional().nullable(),
  itemCount: z.number().int().min(1).max(1000).optional(),
  note: z.string().trim().max(500).optional().nullable(),
  consignmentId: z.string().trim().max(120).optional().nullable(),
  trackingCode: z.string().trim().max(120).optional().nullable(),
});

/** Create or update a draft parcel (nothing is sent to the courier). */
export const saveDraftParcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => draftSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    const items = data.orderId ? await orderItems(supabase, data.orderId) : [];
    const row = {
      store_id: store.id,
      order_id: data.orderId ?? null,
      courier_key: data.courierKey,
      recipient_name: data.recipientName,
      recipient_phone: data.recipientPhone,
      recipient_address: data.recipientAddress,
      recipient_city: data.recipientCity ?? null,
      recipient_zone: data.recipientZone ?? null,
      recipient_area: data.recipientArea ?? null,
      cod_amount: data.codAmount,
      delivery_charge: data.deliveryCharge ?? 0,
      weight: data.weight ?? null,
      dimensions: data.dimensions ?? null,
      item_count: data.itemCount ?? Math.max(1, items.length),
      items,
      note: data.note ?? null,
      consignment_id: data.consignmentId ?? null,
      tracking_code: data.trackingCode ?? null,
      tracking_url: buildTrackingUrl(data.courierKey, data.trackingCode ?? data.consignmentId, data.recipientPhone),
    };
    if (data.id) {
      const { error } = await supabase
        .from("courier_parcels")
        .update(row)
        .eq("id", data.id)
        .eq("store_id", store.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("courier_parcels")
      .insert({ ...row, status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await addEvent(supabase, store.id, inserted.id, "draft", "Draft parcel created", "manual");
    return { ok: true, id: inserted.id };
  });

/** Create the parcel at the courier (from a draft or straight from an order). */
export const sendParcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ parcelId: uuid.optional(), orderId: uuid.optional(), courierKey: z.enum(COURIER_KEYS).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    return dispatchParcel(supabase, store, data);
  });

export const bulkSendParcels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        parcelIds: z.array(uuid).max(50).optional(),
        orderIds: z.array(uuid).max(50).optional(),
        courierKey: z.enum(COURIER_KEYS).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    const jobs = [
      ...(data.parcelIds ?? []).map((id) => ({ parcelId: id, courierKey: data.courierKey })),
      ...(data.orderIds ?? []).map((id) => ({ orderId: id, courierKey: data.courierKey })),
    ];
    let sent = 0;
    const failures: Array<{ id: string; message: string }> = [];
    for (const job of jobs) {
      try {
        await dispatchParcel(supabase, store, job as any);
        sent += 1;
      } catch (e) {
        failures.push({ id: (job as any).parcelId ?? (job as any).orderId, message: (e as Error).message });
      }
    }
    return { sent, failed: failures.length, failures };
  });

export const refreshParcelStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(uuid).min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    let updated = 0;
    const errors: string[] = [];
    for (const id of data.ids) {
      try {
        const changed = await syncOne(supabase, store, id);
        if (changed) updated += 1;
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    return { updated, checked: data.ids.length, errors: errors.slice(0, 5) };
  });

export const cancelParcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, reason: z.string().trim().max(300).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    const parcel = await loadParcel(supabase, store.id, data.id);
    let message = "Cancelled locally";
    const { getAdapter } = await import("@/lib/couriers/registry.server");
    const adapter = getAdapter(parcel.courier_key);
    const ctx = buildCtx(store, parcel.courier_key);
    if (adapter.cancelParcel && ctx) {
      try {
        const r = await adapter.cancelParcel(ctx, toInput(parcel));
        message = r.message;
      } catch (e) {
        message = (e as Error).message;
      }
      await writeLogs(supabase, store.id, parcel.id, parcel.courier_key, ctx.logs);
    }
    await supabase
      .from("courier_parcels")
      .update({ status: "cancelled", last_error: null })
      .eq("id", parcel.id)
      .eq("store_id", store.id);
    await addEvent(supabase, store.id, parcel.id, "cancelled", data.reason ?? message, "manual");
    if (parcel.order_id) {
      try {
        const { pushOrzenOrder } = await import("@/lib/orzen-sync.server");
        await pushOrzenOrder(store.id, parcel.order_id, "order.courier_updated", { courier: parcel.courier_key, courier_status: "cancelled", reason: data.reason ?? null });
      } catch { /* non-fatal */ }
    }
    return { ok: true, message };
  });

/** Clone a failed/cancelled parcel into a fresh draft and send it again. */
export const recreateParcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, send: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    const old = await loadParcel(supabase, store.id, data.id);
    const { id, created_at, updated_at, ...rest } = old as any;
    const { data: inserted, error } = await supabase
      .from("courier_parcels")
      .insert({
        ...rest,
        status: "draft",
        consignment_id: null,
        tracking_code: null,
        tracking_url: null,
        response_payload: null,
        last_error: null,
        last_synced_at: null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await addEvent(supabase, store.id, inserted.id, "draft", "Recreated from a previous parcel", "manual");
    if (data.send !== false) {
      return dispatchParcel(supabase, store, { parcelId: inserted.id });
    }
    return { ok: true, id: inserted.id };
  });

/** Manual status/tracking override — required for manual couriers. */
export const updateParcelManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid,
        status: z.enum(PARCEL_STATUSES).optional(),
        trackingCode: z.string().trim().max(120).optional().nullable(),
        collectionStatus: z.enum(["pending", "collected", "paid", "not_applicable"]).optional(),
        returnCharge: z.number().finite().min(0).max(1000000).optional(),
        note: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    const parcel = await loadParcel(supabase, store.id, data.id);
    const patch: Record<string, any> = {};
    if (data.status) patch.status = data.status;
    if (data.trackingCode !== undefined) {
      patch.tracking_code = data.trackingCode;
      patch.consignment_id = data.trackingCode;
      patch.tracking_url = buildTrackingUrl(parcel.courier_key, data.trackingCode, parcel.recipient_phone);
    }
    if (data.collectionStatus) patch.collection_status = data.collectionStatus;
    if (data.returnCharge !== undefined) patch.return_charge = data.returnCharge;
    if (data.note !== undefined) patch.note = data.note;
    const { error } = await supabase
      .from("courier_parcels")
      .update(patch as never)
      .eq("id", data.id)
      .eq("store_id", store.id);
    if (error) throw new Error(error.message);
    if (data.status && data.status !== parcel.status) {
      await addEvent(supabase, store.id, data.id, data.status, "Updated manually", "manual");
      await mirrorOrder(supabase, store.id, { ...parcel, ...patch, status: data.status });
    }
    return { ok: true };
  });

export const requestPickup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        courierKey: z.enum(COURIER_KEYS),
        contactName: z.string().trim().max(120).optional(),
        phone: z.string().trim().max(30).optional(),
        address: z.string().trim().max(400).optional(),
        pickupDate: z.string().trim().max(20).optional(),
        parcelCount: z.number().int().min(0).max(10000).optional(),
        note: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    const cfg = courierCfg(store, data.courierKey);
    const pickup = cfg.pickup ?? {};
    let status = "requested";
    let message = "Pickup request recorded";
    let raw: unknown = null;
    const ctx = buildCtx(store, data.courierKey);
    const { getAdapter } = await import("@/lib/couriers/registry.server");
    const adapter = getAdapter(data.courierKey);
    if (adapter.requestPickup && ctx) {
      try {
        const r = await adapter.requestPickup(ctx, {
          contactName: data.contactName ?? pickup.contactName,
          phone: data.phone ?? pickup.phone,
          address: data.address ?? pickup.address,
          date: data.pickupDate,
          parcelCount: data.parcelCount ?? 0,
        });
        status = r.ok ? "requested" : "failed";
        message = r.message;
        raw = r.raw ?? null;
      } catch (e) {
        status = "failed";
        message = (e as Error).message;
      }
      await writeLogs(supabase, store.id, null, data.courierKey, ctx.logs);
    }
    const { error } = await supabase.from("courier_pickup_requests").insert({
      store_id: store.id,
      courier_key: data.courierKey,
      contact_name: data.contactName ?? pickup.contactName ?? null,
      phone: data.phone ?? pickup.phone ?? null,
      address: data.address ?? pickup.address ?? null,
      pickup_date: data.pickupDate || null,
      parcel_count: data.parcelCount ?? 0,
      status,
      note: data.note ?? null,
      response: raw as any,
    });
    if (error) throw new Error(error.message);
    return { ok: status !== "failed", message };
  });

export const listPickupHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ courierKey: z.enum(COURIER_KEYS).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const store = await getStore(context.supabase, context.userId);
    let q = context.supabase
      .from("courier_pickup_requests")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data.courierKey) q = q.eq("courier_key", data.courierKey);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const listCourierLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ courierKey: z.enum(COURIER_KEYS).optional(), limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const store = await getStore(context.supabase, context.userId);
    let q = context.supabase
      .from("courier_api_logs")
      .select("id,courier_key,action,endpoint,method,http_status,duration_ms,ok,error,request,response,created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.courierKey) q = q.eq("courier_key", data.courierKey);
    const { data: rows } = await q;
    return rows ?? [];
  });

/** Data needed to render an invoice / shipping label / packing slip. */
export const getParcelPrintData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(uuid).min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await getStore(supabase, userId);
    const { data: rows } = await supabase
      .from("courier_parcels")
      .select("*")
      .eq("store_id", store.id)
      .in("id", data.ids);
    const { data: s } = await supabase
      .from("stores")
      .select("name,phone,address,logo_url,currency,slug")
      .eq("id", store.id)
      .maybeSingle();
    const orderIds = (rows ?? []).map((r: any) => r.order_id).filter(Boolean);
    let invoiceByOrder: Record<string, string> = {};
    if (orderIds.length) {
      const { data: orders } = await supabase.from("orders").select("id,invoice_no").in("id", orderIds);
      for (const o of orders ?? []) invoiceByOrder[(o as any).id] = (o as any).invoice_no ?? "";
    }
    return { store: s ?? null, parcels: rows ?? [], invoiceByOrder };
  });

/**
 * Resolve the official courier label for a parcel.
 * Order of preference: courier API label -> courier merchant-panel label page
 * -> ORZEN-generated fallback label.
 */
export const getParcelLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertPlan(supabase, userId, "courier");
    const store = await getStore(supabase, userId);
    const parcel = await loadParcel(supabase, store.id, data.id);
    const { getAdapter, courierName } = await import("@/lib/couriers/registry.server");
    const { courierLabelPanelUrl, labelHelpText } = await import("@/lib/couriers/label");
    const adapter = getAdapter(parcel.courier_key);
    const consignment = parcel.consignment_id ?? parcel.tracking_code ?? null;

    if (adapter.getLabel && consignment) {
      const ctx = buildCtx(store, parcel.courier_key);
      if (ctx) {
        try {
          const r = await adapter.getLabel(ctx, toInput(parcel));
          await writeLogs(supabase, store.id, parcel.id, parcel.courier_key, ctx.logs);
          if (r.url) {
            return { source: "api" as const, url: r.url, message: `${courierName(parcel.courier_key)} label ready` };
          }
        } catch (e) {
          await writeLogs(supabase, store.id, parcel.id, parcel.courier_key, ctx.logs);
          return { source: "fallback" as const, url: null, message: (e as Error).message };
        }
      }
    }

    const panel = consignment ? courierLabelPanelUrl(parcel.courier_key, consignment) : null;
    if (panel) return { source: "panel" as const, url: panel, message: labelHelpText(parcel.courier_key) };
    return {
      source: "fallback" as const,
      url: null,
      message: consignment
        ? labelHelpText(parcel.courier_key)
        : "No consignment ID yet — send the parcel to the courier first.",
    };
  });


/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

async function getStore(supabase: any, userId: string) {
  const store = await myStoreRow(supabase, userId, "id, couriers", "parcels");
  if (!store) throw new Error("No store");
  return store as { id: string; couriers: any };
}

function courierCfg(store: { couriers: any }, key: string): any {
  return (store.couriers ?? {})[key] ?? {};
}

function buildCtx(store: { couriers: any }, key: string) {
  const cfg = courierCfg(store, key);
  const creds: Record<string, string> = { ...(cfg.credentials ?? {}) };
  if (!creds.api_key && cfg.api_key) creds.api_key = cfg.api_key;
  if (!creds.secret && cfg.secret) creds.secret = cfg.secret;
  const baseUrl: string = creds.base_url || cfg.base_url || "";
  return {
    courierKey: key,
    baseUrl,
    creds,
    sandbox: !!cfg.sandbox,
    pickup: cfg.pickup ?? {},
    logs: [] as any[],
  };
}

async function loadParcel(supabase: any, storeId: string, id: string) {
  const { data } = await supabase
    .from("courier_parcels")
    .select("*")
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!data) throw new Error("Parcel not found");
  return data as any;
}

async function orderItems(supabase: any, orderId: string) {
  const { data } = await supabase
    .from("order_items")
    .select("name_snapshot,price_snapshot,qty,products(primary_image_url)")
    .eq("order_id", orderId);
  return (data ?? []).map((i: any) => {
    const rawImg = i.products?.primary_image_url as string | null | undefined;
    return {
      name: i.name_snapshot,
      qty: i.qty,
      price: Number(i.price_snapshot ?? 0),
      image: rawImg ? (rawImg.startsWith("http") || rawImg.startsWith("/") ? rawImg : `/api/img/${rawImg}`) : null,
    };
  });
}

function toInput(parcel: any) {
  return {
    id: parcel.id,
    invoice: parcel.invoice ?? parcel.id.slice(0, 8).toUpperCase(),
    recipientName: parcel.recipient_name ?? "",
    recipientPhone: parcel.recipient_phone ?? "",
    recipientAddress: parcel.recipient_address ?? "",
    recipientCity: parcel.recipient_city,
    recipientZone: parcel.recipient_zone,
    recipientArea: parcel.recipient_area,
    codAmount: Number(parcel.cod_amount ?? 0),
    weight: parcel.weight != null ? Number(parcel.weight) : null,
    itemCount: parcel.item_count ?? 1,
    note: parcel.note,
    items: Array.isArray(parcel.items) ? parcel.items : [],
    consignmentId: parcel.consignment_id,
    trackingCode: parcel.tracking_code,
  };
}

async function addEvent(
  supabase: any,
  storeId: string,
  parcelId: string,
  status: string,
  message: string | null,
  source: "api" | "manual" | "webhook" | "cron",
) {
  await supabase
    .from("courier_parcel_events")
    .insert({ store_id: storeId, parcel_id: parcelId, status, message, source });
}

async function writeLogs(
  supabase: any,
  storeId: string,
  parcelId: string | null,
  courierKey: string,
  logs: any[],
) {
  if (!logs?.length) return;
  await supabase.from("courier_api_logs").insert(
    logs.map((l) => ({
      store_id: storeId,
      parcel_id: parcelId,
      courier_key: courierKey,
      action: l.action,
      endpoint: l.endpoint,
      method: l.method,
      request: l.request,
      response: l.response,
      http_status: l.http_status,
      duration_ms: l.duration_ms,
      ok: l.ok,
      error: l.error,
    })),
  );
}

/** Create the parcel row (if needed) and push it to the courier. */
export async function dispatchParcel(
  supabase: any,
  store: { id: string; couriers: any },
  input: {
    parcelId?: string;
    orderId?: string;
    courierKey?: string;
    weight?: number;
    note?: string;
    codAmount?: number;
  },
) {
  let parcel: any;
  if (input.parcelId) {
    parcel = await loadParcel(supabase, store.id, input.parcelId);
  } else if (input.orderId) {
    const key = input.courierKey ?? defaultCourier(store);
    if (!key) throw new Error("No default courier is enabled");
    const { data: order } = await supabase
      .from("orders")
      .select("id,invoice_no,customer_name,phone,address,area,subtotal,paid_amount,delivery_amount,discount_amount,payment_method,payment_status")
      .eq("id", input.orderId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    const digits = String(order.phone ?? "").replace(/\D/g, "");
    if (digits.length < 10) throw new Error("কাস্টমারের ফোন নম্বর সঠিক নয় — আগে অর্ডারে ঠিক করুন");
    if (String(order.address ?? "").trim().length < 3) throw new Error("ডেলিভারি ঠিকানা নেই — আগে অর্ডারে ঠিকানা দিন");
    if (!String(order.customer_name ?? "").trim()) throw new Error("কাস্টমারের নাম নেই");
    // Duplicate guard: never create a second live parcel for the same order.
    const { data: existingRows } = await supabase
      .from("courier_parcels")
      .select("id,status")
      .eq("order_id", order.id)
      .eq("store_id", store.id)
      .not("status", "in", "(cancelled,failed)")
      .order("created_at", { ascending: false })
      .limit(1);
    const existing = (existingRows ?? [])[0];
    if (existing) {
      parcel = await loadParcel(supabase, store.id, existing.id);
    } else {
      const items = await orderItems(supabase, order.id);
      const cod =
        input.codAmount != null && Number.isFinite(input.codAmount)
          ? Math.max(0, input.codAmount)
          : collectAmount(order);
      const { data: inserted, error } = await supabase
        .from("courier_parcels")
        .insert({
          store_id: store.id,
          order_id: order.id,
          courier_key: key,
          status: "draft",
          recipient_name: order.customer_name,
          recipient_phone: order.phone,
          recipient_address: order.address,
          recipient_city: order.area ?? null,
          cod_amount: cod,
          delivery_charge: Number(order.delivery_amount ?? 0),
          item_count: Math.max(1, items.reduce((n: number, i: any) => n + (i.qty ?? 1), 0)),
          items,
          weight: input.weight ?? null,
          note: input.note ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      parcel = inserted;
    }
  } else {
    throw new Error("Nothing to send");
  }

  if ((input.weight != null || input.note) && parcel.status === "draft") {
    const patch: Record<string, unknown> = {};
    if (input.weight != null) patch.weight = input.weight;
    if (input.note) patch.note = input.note;
    await supabase.from("courier_parcels").update(patch as never).eq("id", parcel.id);
    parcel = { ...parcel, ...patch };
  }

  if (parcel.consignment_id && !["failed", "cancelled", "draft"].includes(parcel.status)) {
    return { ok: true, id: parcel.id, alreadySent: true, message: "Parcel already created" };
  }


  const key = parcel.courier_key;
  const { getAdapter, assertCredentials, courierName } = await import("@/lib/couriers/registry.server");
  const adapter = getAdapter(key);
  const ctx = buildCtx(store, key);
  if (!ctx) throw new Error(`${courierName(key)} is not configured`);
  assertCredentials(adapter, ctx.creds);

  const invoiceNo = await invoiceFor(supabase, parcel);
  try {
    const res = await adapter.createParcel(ctx, { ...toInput(parcel), invoice: invoiceNo });
    await writeLogs(supabase, store.id, parcel.id, key, ctx.logs);
    const trackingCode = res.trackingCode ?? res.consignmentId ?? null;
    await supabase
      .from("courier_parcels")
      .update({
        status: adapter.hasApi ? res.status : "pending",
        consignment_id: res.consignmentId ?? parcel.consignment_id,
        tracking_code: trackingCode ?? parcel.tracking_code,
        tracking_url: buildTrackingUrl(key, trackingCode ?? parcel.tracking_code, parcel.recipient_phone),
        response_payload: (res.raw ?? null) as any,
        last_error: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", parcel.id);
    await addEvent(
      supabase,
      store.id,
      parcel.id,
      res.status,
      adapter.hasApi ? "Parcel created at courier" : "Parcel recorded (manual courier)",
      adapter.hasApi ? "api" : "manual",
    );
    if (parcel.order_id) {
      await supabase
        .from("orders")
        .update({
          courier_code: key,
          courier_name: key,
          courier_tracking_id: trackingCode,
          courier_status: res.status,
          courier_last_synced_at: new Date().toISOString(),
        })
        .eq("id", parcel.order_id)
        .eq("store_id", store.id);
    }
    if (parcel.order_id) {
      try {
        const { pushOrzenOrder } = await import("@/lib/orzen-sync.server");
        await pushOrzenOrder(store.id, parcel.order_id, "order.courier_updated", { courier: key, courier_status: res.status, tracking_code: trackingCode, tracking_url: buildTrackingUrl(key, trackingCode, parcel.recipient_phone), courier_event: "sent_to_courier" });
      } catch { /* non-fatal */ }
    }
    return { ok: true, id: parcel.id, trackingCode, message: "Parcel created" };
  } catch (e) {
    await writeLogs(supabase, store.id, parcel.id, key, ctx.logs);
    const message = (e as Error).message;
    await supabase
      .from("courier_parcels")
      .update({ status: "failed", last_error: message })
      .eq("id", parcel.id);
    await addEvent(supabase, store.id, parcel.id, "failed", message, "api");
    throw new Error(message);
  }
}

function defaultCourier(store: { couriers: any }): string | null {
  const all = store.couriers ?? {};
  const entries = Object.entries(all) as Array<[string, any]>;
  const def = entries.find(([, c]) => c?.enabled && c?.is_default);
  if (def) return def[0];
  const first = entries.find(([, c]) => c?.enabled);
  return first ? first[0] : null;
}

async function invoiceFor(supabase: any, parcel: any) {
  if (parcel.order_id) {
    const { data } = await supabase.from("orders").select("invoice_no").eq("id", parcel.order_id).maybeSingle();
    if (data?.invoice_no) return String(data.invoice_no);
  }
  return String(parcel.id).slice(0, 8).toUpperCase();
}

export async function syncOne(supabase: any, store: { id: string; couriers: any }, id: string) {
  const parcel = await loadParcel(supabase, store.id, id);
  const { getAdapter } = await import("@/lib/couriers/registry.server");
  const adapter = getAdapter(parcel.courier_key);
  if (!adapter.getStatus) return false;
  const ctx = buildCtx(store, parcel.courier_key);
  if (!ctx) return false;
  try {
    const res = await adapter.getStatus(ctx, toInput(parcel));
    await writeLogs(supabase, store.id, parcel.id, parcel.courier_key, ctx.logs);
    const patch: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
      last_error: null,
    };
    const changed = res.status !== parcel.status;
    if (changed) patch.status = res.status;
    if (res.status === "delivered") patch.collection_status = "collected";
    await supabase.from("courier_parcels").update(patch as never).eq("id", parcel.id);
    if (changed) {
      await addEvent(supabase, store.id, parcel.id, res.status, res.message ?? null, "api");
      await mirrorOrder(supabase, store.id, { ...parcel, status: res.status });
      if (parcel.order_id) {
        try {
          const { pushOrzenOrder } = await import("@/lib/orzen-sync.server");
          await pushOrzenOrder(store.id, parcel.order_id, "order.courier_updated", { courier: parcel.courier_key, courier_status: res.status, previous_courier_status: parcel.status, tracking_code: parcel.tracking_code ?? null, message: res.message ?? null });
        } catch { /* non-fatal */ }
      }
    }
    return changed;
  } catch (e) {
    await writeLogs(supabase, store.id, parcel.id, parcel.courier_key, ctx.logs);
    await supabase
      .from("courier_parcels")
      .update({ last_error: (e as Error).message, last_synced_at: new Date().toISOString() })
      .eq("id", parcel.id);
    throw e;
  }
}

/** Mirror the courier status onto the order record. */
async function mirrorOrder(supabase: any, storeId: string, parcel: any) {
  if (!parcel.order_id) return;
  await supabase
    .from("orders")
    .update({
      courier_status: parcel.status,
      courier_tracking_id: parcel.tracking_code ?? null,
      courier_last_synced_at: new Date().toISOString(),
      ...(parcel.status === "delivered" ? { status: "delivered" } : {}),
    })
    .eq("id", parcel.order_id)
    .eq("store_id", storeId);
}

export { ACTIVE_STATUSES };
