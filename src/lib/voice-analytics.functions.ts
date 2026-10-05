// Store-scoped call analytics and detailed call logs for the AI Call Center.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOwnedStoreId } from "@/lib/admin-order.server";

const Range = z.object({ from: z.string().datetime(), to: z.string().datetime() });

const ANSWERED = new Set(["answered", "completed"]);
const NO_ANSWER = new Set(["no_answer", "missed"]);

export const getCallAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Range.parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    const sb = context.supabase as any;
    const rows: any[] = [];
    for (let off = 0; off < 10000; off += 1000) {
      const { data: page, error } = await sb.from("calls")
        .select("order_id,status,result,call_type,duration_sec")
        .eq("store_id", storeId).gte("created_at", data.from).lte("created_at", data.to)
        .order("created_at", { ascending: false }).range(off, off + 999);
      if (error) throw new Error("Could not load call analytics");
      rows.push(...(page ?? []));
      if (!page || page.length < 1000) break;
    }
    const { data: st } = await sb.from("voice_automation_settings").select("call_rate_per_min").eq("store_id", storeId).maybeSingle();
    const rate = st?.call_rate_per_min != null ? Number(st.call_rate_per_min) : null;

    const by = { answered: 0, no_answer: 0, busy: 0, failed: 0, calling: 0 };
    let auto = 0, manual = 0, billedMin = 0, talkSec = 0;
    const autoOrders = new Set<string>(), confirmed = new Set<string>(), cancelled = new Set<string>();
    for (const c of rows) {
      if (c.call_type === "auto_verification") { auto++; if (c.order_id) autoOrders.add(c.order_id); } else manual++;
      if (ANSWERED.has(c.status)) by.answered++;
      else if (NO_ANSWER.has(c.status)) by.no_answer++;
      else if (c.status === "busy") by.busy++;
      else if (c.status === "failed") by.failed++;
      else by.calling++;
      const d = Number(c.duration_sec ?? 0);
      if (d > 0) { billedMin += Math.ceil(d / 60); talkSec += d; }
      if (c.call_type === "auto_verification" && c.order_id) {
        if (c.result === "order_confirmed") confirmed.add(c.order_id);
        else if (c.result === "order_cancelled") cancelled.add(c.order_id);
      }
    }
    // An order confirmed on any attempt counts as confirmed only.
    for (const id of confirmed) cancelled.delete(id);
    const orders = autoOrders.size;
    const unresolved = [...autoOrders].filter((id) => !confirmed.has(id) && !cancelled.has(id)).length;
    const pct = (n: number) => (orders ? Math.round((n / orders) * 1000) / 10 : 0);
    return {
      total: rows.length, auto, manual, by,
      verified_orders: orders,
      confirmed_pct: pct(confirmed.size),
      cancelled_failed_pct: pct(cancelled.size + unresolved),
      cancelled_orders: cancelled.size, unresolved_orders: unresolved,
      billed_minutes: billedMin, talk_seconds: talkSec,
      rate, est_cost: rate != null ? Math.round(billedMin * rate * 100) / 100 : null,
    };
  });

const LogQ = Range.extend({
  status: z.enum(["all", "answered", "no_answer", "busy", "failed", "calling"]).default("all"),
  type: z.enum(["all", "auto", "manual", "retry"]).default("all"),
  hasRecording: z.boolean().default(false),
  q: z.string().max(40).default(""),
  offset: z.number().int().min(0).max(5000).default(0),
  limit: z.number().int().min(1).max(200).default(50),
});

export const listCallLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LogQ.parse(d))
  .handler(async ({ context, data }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    let qb = (context.supabase as any).from("calls")
      .select("id,order_id,customer_name,phone,status,result,dtmf,duration_sec,call_type,retry_count,direction,created_at,recording_ref,orders(invoice_no)")
      .eq("store_id", storeId).gte("created_at", data.from).lte("created_at", data.to);
    if (data.status === "answered") qb = qb.in("status", [...ANSWERED]);
    else if (data.status === "no_answer") qb = qb.in("status", [...NO_ANSWER]);
    else if (data.status === "calling") qb = qb.not("status", "in", "(answered,completed,no_answer,missed,busy,failed)");
    else if (data.status !== "all") qb = qb.eq("status", data.status);
    if (data.type === "auto") qb = qb.eq("call_type", "auto_verification");
    else if (data.type === "manual") qb = qb.neq("call_type", "auto_verification");
    else if (data.type === "retry") qb = qb.gt("retry_count", 0);
    if (data.hasRecording) qb = qb.not("recording_ref", "is", null);
    const q = data.q.replace(/[^\w+\-]/g, "");
    if (q) qb = qb.ilike("phone", `%${q}%`);
    const { data: rows, error } = await qb.order("created_at", { ascending: false }).range(data.offset, data.offset + data.limit);
    if (error) throw new Error("Could not load call logs");
    const { signedRecordingPath } = await import("@/lib/voice/queue.server");
    const list = ((rows ?? []) as any[]);
    return {
      has_more: list.length > data.limit,
      rows: list.slice(0, data.limit).map(({ recording_ref, orders, ...r }) => ({
        ...r, invoice_no: orders?.invoice_no ?? null,
        play_url: recording_ref ? signedRecordingPath(r.id) : null,
      })),
    };
  });
