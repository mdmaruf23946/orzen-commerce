// Inventory server functions — one dynamic page, four product types.
import { createServerFn } from "@tanstack/react-start";
import { myStoreRow } from "@/lib/store-access";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function myStoreId(supabase: any, userId: string): Promise<string | null> {
  const data = await myStoreRow(supabase, userId, "id");
  return data?.id ?? null;
}

const typeIn = (q: any, type: string) =>
  type === "physical" ? q.or("product_type.eq.physical,product_type.is.null") : q.eq("product_type", type);

// ---------- PHYSICAL ----------
export const inventoryPhysical = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    let q = context.supabase
      .from("products")
      .select("id,name,sku,stock,cost_price,price,low_stock_threshold,status,primary_image_url,product_type")
      .eq("store_id", sid);
    q = typeIn(q, "physical");
    const { data } = await q.order("stock", { ascending: true });
    return data ?? [];
  });

export const inventoryMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(300).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sid = await myStoreId(context.supabase, context.userId);
    if (!sid) return [];
    let q = context.supabase
      .from("stock_movements")
      .select(
        "id,product_id,delta,type,reason,ref_order_id,created_at,created_by,qty_before,qty_after,products(name),orders:ref_order_id(invoice_no)",
      )
      .eq("store_id", sid)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 150);
    if (data.productId) q = q.eq("product_id", data.productId);
    const { data: rows } = await q;
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      product_id: r.product_id,
      product_name: r.products?.name ?? "—",
      delta: r.delta,
      type: r.type,
      reason: r.reason,
      order_id: r.ref_order_id,
      invoice_no: r.orders?.invoice_no ?? null,
      created_at: r.created_at,
      qty_before: r.qty_before,
      qty_after: r.qty_after,
      by: r.created_by ? "Merchant panel" : "System",
    }));
  });

// ---------- DIGITAL ----------
export const inventoryDigital = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const sid = await myStoreId(sb, context.userId);
    if (!sid) return [];
    const { data: products } = await sb
      .from("products")
      .select("id,name,sku,price,status,primary_image_url,meta")
      .eq("store_id", sid)
      .eq("product_type", "digital")
      .order("name");
    const ids = (products ?? []).map((p: any) => p.id);
    if (ids.length === 0) return [];

    const [{ data: ents }, { data: items }, { data: dls }] = await Promise.all([
      sb
        .from("digital_entitlements")
        .select("product_id,status,download_count,max_downloads")
        .eq("store_id", sid)
        .in("product_id", ids),
      sb
        .from("order_items")
        .select("product_id,qty,orders!inner(id,store_id,status)")
        .eq("orders.store_id", sid)
        .in("product_id", ids),
      sb
        .from("digital_downloads")
        .select("created_at,digital_entitlements!inner(product_id)")
        .eq("store_id", sid)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    const lastDl = new Map<string, string>();
    for (const d of (dls ?? []) as any[]) {
      const pid = d.digital_entitlements?.product_id;
      if (pid && !lastDl.has(pid)) lastDl.set(pid, d.created_at);
    }

    return (products ?? []).map((p: any) => {
      const meta = (p.meta?.digital ?? {}) as any;
      const rows = ((ents ?? []) as any[]).filter((e) => e.product_id === p.id);
      const downloads = rows.reduce((s, r) => s + Number(r.download_count ?? 0), 0);
      const unlimited = rows.length === 0 ? !meta?.download?.max_downloads : rows.every((r) => r.max_downloads == null);
      const remaining = unlimited
        ? null
        : rows.reduce((s, r) => s + Math.max(0, Number(r.max_downloads ?? 0) - Number(r.download_count ?? 0)), 0);
      const sales = ((items ?? []) as any[])
        .filter((i) => i.product_id === p.id && i.orders?.status !== "cancelled")
        .reduce((s, i) => s + Number(i.qty ?? 1), 0);
      const files = Array.isArray(meta.files) ? meta.files : [];
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.price,
        status: p.status,
        image: p.primary_image_url,
        sales,
        downloads,
        remaining,
        unlimited,
        activeEntitlements: rows.filter((r) => r.status === "active").length,
        licenseType: meta.license_type ?? null,
        version: meta.version ?? null,
        fileCount: files.length,
        fileSize: files.reduce((s: number, f: any) => s + Number(f?.size ?? 0), 0),
        maxDownloads: meta?.download?.max_downloads ?? null,
        delivery: meta?.download?.mode === "manual" ? "manual" : "instant",
        lastDownload: lastDl.get(p.id) ?? null,
      };
    });
  });

export const updateDigitalDownloadLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ productId: z.string().uuid(), maxDownloads: z.number().int().min(0).max(9999).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const sid = await myStoreId(sb, context.userId);
    if (!sid) throw new Error("No store");
    const { data: p } = await sb
      .from("products")
      .select("id,meta")
      .eq("id", data.productId)
      .eq("store_id", sid)
      .maybeSingle();
    if (!p) throw new Error("Product not found");
    const meta = (p.meta ?? {}) as any;
    const next = {
      ...meta,
      digital: { ...(meta.digital ?? {}), download: { ...(meta.digital?.download ?? {}), max_downloads: data.maxDownloads } },
    };
    const { error } = await sb.from("products").update({ meta: next }).eq("id", p.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const digitalDownloadLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const sid = await myStoreId(sb, context.userId);
    if (!sid) return [];
    const { data: rows } = await sb
      .from("digital_downloads")
      .select("id,created_at,file_path,ip,device_id,digital_entitlements!inner(product_id,customer_email,customer_phone)")
      .eq("store_id", sid)
      .eq("digital_entitlements.product_id", data.productId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      file: r.file_path,
      who: r.digital_entitlements?.customer_email ?? r.digital_entitlements?.customer_phone ?? "—",
      device: r.device_id ?? null,
    }));
  });

// ---------- SERVICE ----------
const ACTIVE_STAGES = ["confirmed", "consultation_scheduled", "in_progress", "waiting_for_client", "revision"];

export const inventoryService = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const sid = await myStoreId(sb, context.userId);
    if (!sid) return [];
    const { data: products } = await sb
      .from("products")
      .select("id,name,sku,price,status,primary_image_url,meta")
      .eq("store_id", sid)
      .eq("product_type", "service")
      .order("name");
    const ids = (products ?? []).map((p: any) => p.id);
    if (ids.length === 0) return [];
    const { data: items } = await sb
      .from("order_items")
      .select("product_id,orders!inner(id,store_id,status,created_at,updated_at,fulfillment_meta)")
      .eq("orders.store_id", sid)
      .in("product_id", ids);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return (products ?? []).map((p: any) => {
      const meta = (p.meta?.service ?? {}) as any;
      const rows = ((items ?? []) as any[]).filter((i) => i.product_id === p.id);
      let active = 0,
        pending = 0,
        completed = 0,
        cancelled = 0,
        today = 0;
      let durSum = 0,
        durCount = 0;
      for (const r of rows) {
        const o = r.orders;
        const stage = o?.fulfillment_meta?.service_state?.stage as string | undefined;
        if (o?.status === "cancelled") cancelled++;
        else if (stage === "completed" || stage === "closed" || o?.status === "delivered") {
          completed++;
          const ms = new Date(o.updated_at).getTime() - new Date(o.created_at).getTime();
          if (ms > 0) {
            durSum += ms;
            durCount++;
          }
        } else if (!stage || stage === "request_submitted" || stage === "pending_review") pending++;
        else if (ACTIVE_STAGES.includes(stage)) active++;
        else pending++;
        if (o?.created_at && new Date(o.created_at) >= startOfDay && o?.status !== "cancelled") today++;
      }
      const perDay = Number(meta.capacity_per_day ?? 0) || null;
      const perWeek = Number(meta.capacity_per_week ?? 0) || null;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.price,
        status: p.status,
        image: p.primary_image_url,
        active,
        pending,
        completed,
        cancelled,
        capacityPerDay: perDay,
        capacityPerWeek: perWeek,
        bookedToday: today,
        availableToday: perDay == null ? null : Math.max(0, perDay - today),
        paused: Boolean(meta.booking_paused),
        avgCompletionHours: durCount ? Math.round(durSum / durCount / 3_600_000) : null,
      };
    });
  });

export const updateServiceCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        capacityPerDay: z.number().int().min(0).max(9999).nullable(),
        capacityPerWeek: z.number().int().min(0).max(99999).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => patchServiceMeta(context, data.productId, {
    capacity_per_day: data.capacityPerDay,
    capacity_per_week: data.capacityPerWeek,
  }));

export const setServiceBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid(), paused: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => patchServiceMeta(context, data.productId, { booking_paused: data.paused }));

async function patchServiceMeta(context: any, productId: string, patch: Record<string, unknown>) {
  const sb = context.supabase;
  const sid = await myStoreId(sb, context.userId);
  if (!sid) throw new Error("No store");
  const { data: p } = await sb.from("products").select("id,meta").eq("id", productId).eq("store_id", sid).maybeSingle();
  if (!p) throw new Error("Product not found");
  const meta = (p.meta ?? {}) as any;
  const next = { ...meta, service: { ...(meta.service ?? {}), ...patch } };
  const { error } = await sb.from("products").update({ meta: next }).eq("id", p.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ---------- SUBSCRIPTION ----------
const CYCLE_MONTHS: Record<string, number> = {
  weekly: 0.23,
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
  lifetime: 0,
  custom: 1,
};

export const inventorySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const sid = await myStoreId(sb, context.userId);
    if (!sid) return [];
    const { data: products } = await sb
      .from("products")
      .select("id,name,sku,price,status,primary_image_url,meta")
      .eq("store_id", sid)
      .eq("product_type", "subscription")
      .order("name");
    const ids = (products ?? []).map((p: any) => p.id);
    if (ids.length === 0) return [];
    const { data: subs } = await sb
      .from("store_subscriptions")
      .select("product_id,status,billing_cycle,renewal_price,price,next_billing_date,trial_ends_at")
      .eq("store_id", sid)
      .in("product_id", ids);

    const in30 = Date.now() + 30 * 86_400_000;

    return (products ?? []).map((p: any) => {
      const meta = (p.meta?.subscription ?? {}) as any;
      const rows = ((subs ?? []) as any[]).filter((s) => s.product_id === p.id);
      const by = (st: string) => rows.filter((s) => s.status === st).length;
      const active = by("active") + by("past_due") + by("grace");
      const trialing = by("trialing");
      const cancelled = by("cancelled");
      const expired = by("expired");
      const churned = cancelled + expired;
      const renewals = rows.filter(
        (s) => (s.status === "active" || s.status === "trialing") && s.next_billing_date && new Date(s.next_billing_date).getTime() <= in30,
      ).length;
      const mrr = rows
        .filter((s) => s.status === "active")
        .reduce((sum, s) => {
          const months = CYCLE_MONTHS[s.billing_cycle ?? "monthly"] ?? 1;
          const amount = Number(s.renewal_price ?? s.price ?? 0);
          return sum + (months > 0 ? amount / months : 0);
        }, 0);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.price,
        status: p.status,
        image: p.primary_image_url,
        active,
        trialing,
        expired,
        cancelled,
        renewalRate: active + churned > 0 ? Math.round((active / (active + churned)) * 100) : null,
        renewalsDue: renewals,
        mrr: Math.round(mrr),
        billingCycle: (rows[0]?.billing_cycle ?? meta.billing_cycle ?? meta.cycle ?? null) as string | null,
      };
    });
  });

export const subscriptionSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const sid = await myStoreId(sb, context.userId);
    if (!sid) return [];
    const { data: rows } = await sb
      .from("store_subscriptions")
      .select("id,subscription_no,customer_name,customer_email,customer_phone,status,billing_cycle,renewal_price,price,next_billing_date,created_at,order_id")
      .eq("store_id", sid)
      .eq("product_id", data.productId)
      .order("created_at", { ascending: false })
      .limit(500);
    return rows ?? [];
  });
