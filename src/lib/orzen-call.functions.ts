// Orzen Call (own AI voice platform) settings. Store always comes from the
// signed-in owner; the callback token is never returned except inside the
// owner's own callback URL.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOwnedStoreId } from "@/lib/admin-order.server";

async function ownStore(ctx: any) {
  const id = await getOwnedStoreId(ctx.supabase, ctx.userId);
  if (!id) throw new Error("Store not found");
  return id as string;
}

function originOf() {
  try {
    const req = getRequest();
    const u = new URL(req.url);
    const host = req.headers.get("x-forwarded-host") || u.host;
    return `https://${host}`;
  } catch {
    return "https://orzen.top";
  }
}

async function loadRow(storeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("voice_provider_connections")
    .select("status,account_info,encrypted_token,connected_at")
    .eq("store_id", storeId)
    .eq("provider", "orzen_call")
    .maybeSingle();
  return { supabaseAdmin, row: data as any };
}

export const getOrzenCallSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { row } = await loadRow(storeId);
    const info = row?.account_info ?? {};
    const token = row?.encrypted_token as string | undefined;
    return {
      connected: row?.status === "connected",
      webhook_url: (info.webhook_url as string) ?? "",
      auto_orders: info.auto_orders !== false,
      auto_products: info.auto_products !== false,
      callback_url: token
        ? `${originOf()}/api/public/orzen-call/callback?s=${storeId}&k=${token}`
        : null,
      connected_at: row?.connected_at ?? null,
      secret: token ?? null,
      outcome_map: readOutcomeMap(info),
      last_synced: [info.last_full_sync, info.last_orders_sync, info.last_test_ok ? info.last_test : null]
        .filter(Boolean).sort().pop() ?? null,
      last_test: (info.last_test as string) ?? null,
      last_test_ok: (info.last_test_ok as boolean) ?? null,
      last_test_message: (info.last_test_message as string) ?? null,
    };
  });

export type OutcomeMap = { confirm: "confirmed" | "processing"; cancel: "cancelled" | "on_hold"; no_answer: "no_response" | "on_hold" | "none" };
function readOutcomeMap(info: any): OutcomeMap {
  const m = info?.outcome_map ?? {};
  return {
    confirm: m.confirm === "processing" ? "processing" : "confirmed",
    cancel: m.cancel === "on_hold" ? "on_hold" : "cancelled",
    no_answer: ["on_hold", "none"].includes(m.no_answer) ? m.no_answer : "no_response",
  };
}
const OutcomeSchema = z.object({
  confirm: z.enum(["confirmed", "processing"]),
  cancel: z.enum(["cancelled", "on_hold"]),
  no_answer: z.enum(["no_response", "on_hold", "none"]),
});

const UrlSchema = z.string().trim().max(500).refine((v) => {
  try {
    const u = new URL(v);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && h.includes(".") && h !== "localhost" && !/^[\d.]+$/.test(h);
  } catch {
    return false;
  }
}, "Webhook URL must be a public https:// link.");

export const saveOrzenCallSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ webhook_url: UrlSchema, auto_orders: z.boolean(), auto_products: z.boolean(), outcome_map: OutcomeSchema.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await ownStore(context);
    const { supabaseAdmin, row } = await loadRow(storeId);
    const { randomBytes } = await import("node:crypto");
    const token = (row?.encrypted_token as string) || randomBytes(24).toString("hex");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("voice_provider_connections").upsert(
      {
        store_id: storeId,
        provider: "orzen_call",
        status: "connected",
        encrypted_token: token,
        token_preview: token.slice(0, 6) + "…",
        account_info: {
          ...(row?.account_info ?? {}),
          webhook_url: data.webhook_url,
          auto_orders: data.auto_orders,
          auto_products: data.auto_products,
          outcome_map: data.outcome_map ?? readOutcomeMap(row?.account_info),
        },
        connected_at: row?.status === "connected" ? undefined : now,
        updated_at: now,
      } as never,
      { onConflict: "store_id,provider" },
    );
    if (error) return { ok: false, message: "Could not save settings. Please try again." };
    return { ok: true, message: "Settings saved" };
  });

export const disconnectOrzenCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("voice_provider_connections")
      .update({ status: "not_connected", encrypted_token: null, updated_at: new Date().toISOString() } as never)
      .eq("store_id", storeId)
      .eq("provider", "orzen_call");
    return { ok: true };
  });

/* ------------------------- dashboard, history, sync ------------------------- */

async function postToOrzen(storeId: string, event: string, data: unknown) {
  const { row } = await loadRow(storeId);
  const url = row?.account_info?.webhook_url as string | undefined;
  if (row?.status !== "connected" || !url) return { ok: false, message: "Orzen Call is not connected." };
  const body = JSON.stringify({ event, store_id: storeId, sent_at: new Date().toISOString(), data });
  const { createHmac } = await import("node:crypto");
  const sig = createHmac("sha256", (row.encrypted_token as string) ?? "").update(body).digest("hex");
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Orzen-Event": event, "X-Orzen-Signature": sig },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { ok: false, message: `Orzen Call replied with error ${r.status}.` };
    return { ok: true, message: "Delivered" };
  } catch {
    return { ok: false, message: "Could not reach your Orzen Call webhook link." };
  }
}

const SUCCESS_RESULTS = ["order_confirmed"];
const CANCEL_RESULTS = ["order_cancelled"];
const MISSED = ["missed", "no_answer", "busy"];

export const getOrzenCallOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const storeId = await ownStore(context);
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const { data: rows } = await context.supabase
      .from("calls")
      .select("status,result,duration_sec,created_at,order_id,phone,orders(status)")
      .eq("store_id", storeId)
      .eq("provider", "orzen_call")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    const list = (rows ?? []) as any[];
    // Outcome counts are per order (current order status, else latest call result),
    // so repeated test calls on one order count once.
    const outcome = (r: any): "confirmed" | "cancelled" | null => {
      const os = r.orders?.status;
      if (os) return ["confirmed", "processing", "delivered"].includes(os) ? "confirmed" : os === "cancelled" ? "cancelled" : null;
      return SUCCESS_RESULTS.includes(r.result) ? "confirmed" : CANCEL_RESULTS.includes(r.result) ? "cancelled" : null;
    };
    const latest = new Map<string, any>();
    for (const r of list) {
      const key = r.order_id ? `o:${r.order_id}` : `p:${String(r.phone ?? "").replace(/\D/g, "").slice(-10)}`;
      if (!latest.has(key)) latest.set(key, r);
    }
    const uniq = [...latest.values()];
    const confirmed = uniq.filter((r) => outcome(r) === "confirmed").length;
    const cancelled = uniq.filter((r) => outcome(r) === "cancelled").length;
    const missed = list.filter((r) => MISSED.includes(r.status)).length;
    const failed = list.filter((r) => r.status === "failed").length;
    const answered = list.filter((r) => ["answered", "completed"].includes(r.status)).length;
    const dur = list.reduce((a, r) => a + Number(r.duration_sec ?? 0), 0);
    const byDay: Record<string, { day: string; total: number; confirmed: number; cancelled: number }> = {};
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      byDay[d] = { day: d, total: 0, confirmed: 0, cancelled: 0 };
    }
    for (const r of list) {
      const b = byDay[String(r.created_at).slice(0, 10)];
      if (b) b.total++;
    }
    for (const r of uniq) {
      const b = byDay[String(r.created_at).slice(0, 10)];
      if (!b) continue;
      const o = outcome(r);
      if (o === "confirmed") b.confirmed++;
      if (o === "cancelled") b.cancelled++;
    }
    const decided = confirmed + cancelled;
    return {
      total: list.length,
      answered,
      confirmed,
      cancelled,
      missed,
      failed,
      success_rate: uniq.length ? Math.round((confirmed / uniq.length) * 100) : 0,
      confirm_rate: decided ? Math.round((confirmed / decided) * 100) : 0,
      avg_duration: answered ? Math.round(dur / answered) : 0,
      total_duration: dur,
      daily: Object.values(byDay),
    };
  });

export const listOrzenCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      filter: z.enum(["all", "today", "confirmed", "cancelled", "missed", "failed"]).default("all"),
      search: z.string().trim().max(80).default(""),
      limit: z.number().int().min(1).max(200).default(100),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const storeId = await ownStore(context);
    let q = context.supabase
      .from("calls")
      .select("id,order_id,customer_name,phone,status,result,duration_sec,note,transcript,conversation_text,started_at,ended_at,created_at,orders(invoice_no,status)")
      .eq("store_id", storeId)
      .eq("provider", "orzen_call")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.filter === "today") {
      const t = new Date(); t.setHours(0, 0, 0, 0);
      q = q.gte("created_at", t.toISOString());
    } else if (data.filter === "confirmed") q = q.in("result", SUCCESS_RESULTS);
    else if (data.filter === "cancelled") q = q.in("result", CANCEL_RESULTS);
    else if (data.filter === "missed") q = q.in("status", MISSED);
    else if (data.filter === "failed") q = q.eq("status", "failed");
    const s = data.search.replace(/[%,()]/g, "");
    if (s) q = q.or(`phone.ilike.%${s}%,customer_name.ilike.%${s}%`);
    const { data: rows } = await q;
    // One card per order (or per phone when no order): latest call wins, older
    // calls stay attached as history so nothing is lost.
    const groups = new Map<string, any>();
    for (const r of (rows ?? []) as any[]) {
      const key = r.order_id ? `o:${r.order_id}` : `p:${String(r.phone ?? "").replace(/\D/g, "").slice(-10)}`;
      const g = groups.get(key);
      if (!g) groups.set(key, { ...r, history: [r] });
      else g.history.push(r);
    }
    const list = [...groups.values()];
    const orderIds = list.map((g) => g.order_id).filter(Boolean) as string[];
    const details = await orderDetails(context.supabase, storeId, orderIds);
    return list.map((g) => ({
      ...g,
      attempts: g.history.length,
      invoice_no: g.orders?.invoice_no ?? null,
      order_status: g.orders?.status ?? null,
      order: g.order_id ? details[g.order_id] ?? null : null,
    }));
  });

async function orderDetails(sb: any, storeId: string, ids: string[]) {
  const out: Record<string, any> = {};
  if (!ids.length) return out;
  const [{ data: orders }, { data: items }] = await Promise.all([
    sb.from("orders").select("id,invoice_no,status,address,area,payment_method,subtotal,created_at").eq("store_id", storeId).in("id", ids),
    sb.from("order_items").select("order_id,name_snapshot,price_snapshot,qty,products(primary_image_url)").in("order_id", ids),
  ]);
  for (const o of orders ?? []) out[o.id] = { ...o, total: Number(o.subtotal ?? 0), items: [] };
  for (const i of (items ?? []) as any[]) {
    out[i.order_id]?.items.push({ name: i.name_snapshot, qty: Number(i.qty ?? 1), price: Number(i.price_snapshot ?? 0), image: i.products?.primary_image_url ?? null });
  }
  return out;
}

export const getOrzenSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { row } = await loadRow(storeId);
    const info = row?.account_info ?? {};
    const [{ count: products }, { count: pending }, { count: called }] = await Promise.all([
      context.supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      context.supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "pending"),
      context.supabase.from("calls").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("provider", "orzen_call"),
    ]);
    const { data: recent } = await context.supabase
      .from("orders")
      .select("id,invoice_no,customer_name,phone,status,created_at,voice_verification")
      .eq("store_id", storeId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(15);
    const qd = await orderDetails(context.supabase, storeId, (recent ?? []).map((o: any) => o.id));
    return {
      products: products ?? 0,
      pending_orders: pending ?? 0,
      calls_logged: called ?? 0,
      last_full_sync: (info.last_full_sync as string) ?? null,
      last_full_sync_count: (info.last_full_sync_count as number) ?? null,
      last_test: (info.last_test as string) ?? null,
      last_test_ok: (info.last_test_ok as boolean) ?? null,
      queue: (recent ?? []).map((o: any) => ({ ...o, order: qd[o.id] ?? null })),
    };
  });

export const syncAllOrzenProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { supabaseAdmin, row } = await loadRow(storeId);
    if (row?.status !== "connected") return { ok: false, message: "Orzen Call is not connected." };
    const { data: prods } = await supabaseAdmin
      .from("products")
      .select("id,name,sku,price,old_price,stock,status,short_description,description,variants,primary_image_url,slug")
      .eq("store_id", storeId)
      .limit(2000);
    const list = ((prods ?? []) as any[]).map((p) => ({
      id: p.id, name: p.name, sku: p.sku, price: p.price, old_price: p.old_price, stock: p.stock, status: p.status,
      short_description: p.short_description, description: String(p.description ?? "").slice(0, 4000),
      variants: p.variants, image: p.primary_image_url, slug: p.slug,
    }));
    let sent = 0;
    for (let i = 0; i < list.length; i += 50) {
      const chunk = list.slice(i, i + 50);
      const r = await postToOrzen(storeId, "products.sync", { action: "full_sync", products: chunk });
      if (!r.ok) return { ok: false, message: `${r.message} (${sent} of ${list.length} sent)` };
      sent += chunk.length;
    }
    await supabaseAdmin.from("voice_provider_connections")
      .update({ account_info: { ...(row.account_info ?? {}), last_full_sync: new Date().toISOString(), last_full_sync_count: sent } } as never)
      .eq("store_id", storeId).eq("provider", "orzen_call");
    return { ok: true, message: `${sent} products sent to Orzen Call` };
  });

export const sendOrzenTestPing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const r = await postToOrzen(storeId, "ping", { message: "Test from ORZEN Merchant Panel" });
    const { supabaseAdmin, row } = await loadRow(storeId);
    if (row) {
      await supabaseAdmin.from("voice_provider_connections")
        .update({ account_info: { ...(row.account_info ?? {}), last_test: new Date().toISOString(), last_test_ok: r.ok, last_test_message: r.ok ? "Webhook link is working." : r.message } } as never)
        .eq("store_id", storeId).eq("provider", "orzen_call");
    }
    return r.ok ? { ok: true, message: "Test sent — your webhook link is working." } : r;
  });

export const resendOrzenOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await ownStore(context);
    const { data: o } = await context.supabase
      .from("orders")
      .select("id,invoice_no,status,customer_name,phone,address,area,payment_method,delivery_amount,discount_amount,subtotal,notes,created_at,order_items(*)")
      .eq("store_id", storeId).eq("id", data.order_id).maybeSingle();
    if (!o) return { ok: false, message: "Order not found" };
    const { order_items, subtotal, ...rest } = o as any;
    const r = await postToOrzen(storeId, "order.created", { ...rest, total: subtotal, items: order_items ?? [], resend: true });
    return r.ok ? { ok: true, message: "Order sent to Orzen Call" } : r;
  });

export const regenerateOrzenSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { supabaseAdmin, row } = await loadRow(storeId);
    if (!row) return { ok: false, message: "Save settings first." };
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(24).toString("hex");
    const { error } = await supabaseAdmin.from("voice_provider_connections")
      .update({ encrypted_token: token, token_preview: token.slice(0, 6) + "…", updated_at: new Date().toISOString() } as never)
      .eq("store_id", storeId).eq("provider", "orzen_call");
    if (error) return { ok: false, message: "Could not create a new secret." };
    return { ok: true, message: "New secret created — update it in Orzen Call." };
  });

export const syncPendingOrzenOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { supabaseAdmin, row } = await loadRow(storeId);
    if (row?.status !== "connected") return { ok: false, message: "Orzen Call is not connected." };
    const { data: rows } = await supabaseAdmin
      .from("orders")
      .select("id,invoice_no,status,followup_status,customer_name,phone,address,area,payment_method,delivery_amount,discount_amount,subtotal,notes,created_at,order_items(product_id,name_snapshot,price_snapshot,qty)")
      .eq("store_id", storeId).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(1000);
    const list = ((rows ?? []) as any[]).map(({ order_items, subtotal, ...o }) => ({ ...o, order_id: o.id, total: subtotal, items: order_items ?? [] }));
    if (!list.length) return { ok: true, message: "No pending orders to sync." };
    let sent = 0;
    for (let i = 0; i < list.length; i += 25) {
      const chunk = list.slice(i, i + 25);
      const r = await postToOrzen(storeId, "orders.sync", { action: "pending_sync", orders: chunk });
      if (!r.ok) return { ok: false, message: `${r.message} (${sent} of ${list.length} sent)` };
      sent += chunk.length;
    }
    await supabaseAdmin.from("voice_provider_connections")
      .update({ account_info: { ...(row.account_info ?? {}), last_orders_sync: new Date().toISOString(), last_orders_sync_count: sent } } as never)
      .eq("store_id", storeId).eq("provider", "orzen_call");
    return { ok: true, message: `${sent} pending orders sent to Orzen Call` };
  });
