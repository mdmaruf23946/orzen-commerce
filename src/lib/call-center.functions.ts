// Call history and one-click ePBX calling. All reads/writes are scoped to the
// signed-in store owner.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getOwnedStoreId } from "@/lib/admin-order.server";
import {
  CALL_STATUSES, CALL_RESULTS, type CallRow, type CallStatus,
} from "@/lib/call-center";

const FilterSchema = z.object({
  filter: z.enum(["all", "today", "answered", "missed", "failed", "no_answer"]).default("all"),
  search: z.string().trim().max(80).default(""),
  limit: z.number().int().min(1).max(100).default(50),
});

async function storeIdOrThrow(supabase: any, userId: string) {
  const id = await getOwnedStoreId(supabase, userId);
  if (!id) throw new Error("Store not found");
  return id as string;
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/* --------------------------------- calls -------------------------------- */

export const getCallCenterOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("calls")
      .select("status,duration_sec")
      .eq("store_id", storeId)
      .gte("created_at", todayStart());
    const rows = (data ?? []) as { status: CallStatus; duration_sec: number }[];
    const count = (s: CallStatus[]) => rows.filter((r) => s.includes(r.status)).length;
    return {
      total: rows.length,
      answered: count(["answered", "completed"]),
      missed: count(["missed", "no_answer"]),
      busy: count(["busy"]),
      failed: count(["failed"]),
      duration_sec: rows.reduce((a, r) => a + Number(r.duration_sec ?? 0), 0),
    };
  });

const SELECT = "id,store_id,order_id,customer_id,customer_name,phone,agent_email,provider,status,duration_sec,result,note,started_at,ended_at,created_at,orders(invoice_no)";

function shape(r: any): CallRow {
  return { ...r, invoice_no: r.orders?.invoice_no ?? null };
}

export const listCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FilterSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);

    function baseQuery() {
      let q = context.supabase
        .from("calls")
        .select(SELECT)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(data.limit);

      if (data.filter === "today") q = q.gte("created_at", todayStart());
      else if (data.filter === "answered") q = q.in("status", ["answered", "completed"]);
      else if (data.filter === "missed") q = q.eq("status", "missed");
      else if (data.filter === "failed") q = q.eq("status", "failed");
      else if (data.filter === "no_answer") q = q.eq("status", "no_answer");
      return q;
    }

    const s = data.search.trim();
    let rows: any[] = [];

    if (s) {
      const [contactRes, orderRes] = await Promise.all([
        baseQuery().or(`customer_name.ilike.%${s}%,phone.ilike.%${s}%`),
        context.supabase
          .from("orders")
          .select("id")
          .eq("store_id", storeId)
          .ilike("invoice_no", `%${s}%`)
          .limit(50),
      ]);

      if (contactRes.error) throw new Error(contactRes.error.message);
      if (orderRes.error) throw new Error(orderRes.error.message);

      const contactRows = (contactRes.data ?? []) as any[];
      const orderIds = (orderRes.data ?? []).map((o: any) => o.id);

      let invoiceRows: any[] = [];
      if (orderIds.length) {
        const { data: invRows, error: invError } = await baseQuery().in("order_id", orderIds);
        if (invError) throw new Error(invError.message);
        invoiceRows = invRows ?? [];
      }

      const seen = new Set<string>();
      rows = [...contactRows, ...invoiceRows]
        .filter((r) => !seen.has(r.id) && (seen.add(r.id), true))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, data.limit);
    } else {
      const { data: allRows, error } = await baseQuery();
      if (error) throw new Error(error.message);
      rows = allRows ?? [];
    }

    return rows.map(shape);
  });

export const getCallsForOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    const { data: rows } = await context.supabase
      .from("calls")
      .select(SELECT)
      .eq("store_id", storeId)
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: false })
      .limit(20);
    return (rows ?? []).map(shape);
  });

export const getCallsForPhone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { phone: string }) => z.object({ phone: z.string().trim().min(3).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    const { data: rows } = await context.supabase
      .from("calls")
      .select(SELECT)
      .eq("store_id", storeId)
      .eq("phone", data.phone)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (rows ?? []).map(shape);
    return {
      calls: list,
      total: list.length,
      last: list[0] ?? null,
    };
  });

const StartSchema = z.object({
  phone: z.string().trim().min(3).max(40),
  customer_name: z.string().trim().max(120).optional().nullable(),
  order_id: z.string().uuid().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
});

export const startCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartSchema.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: connection } = await supabaseAdmin
      .from("voice_provider_connections")
      .select("id,encrypted_token,status,default_caller_id,default_extension")
      .eq("store_id", storeId)
      .eq("provider", "epbx")
      .maybeSingle();
    if (!connection || connection.status !== "connected" || !connection.encrypted_token) {
      return { ok: false as const, reason: "not_connected" as const };
    }

    const { openToken, getVoiceProvider, friendlyVoiceError } = await import("@/lib/voice/service.server");
    const { signedWebhookUrl } = await import("@/lib/voice/queue.server");
    const creds = openToken(connection.encrypted_token);
    if (!creds) return { ok: false as const, reason: "not_connected" as const };

    const insert: Record<string, any> = {
      store_id: storeId,
      order_id: data.order_id ?? null,
      customer_id: data.customer_id ?? null,
      customer_name: data.customer_name ?? null,
      phone: data.phone,
      agent_id: context.userId,
      agent_email: (context.claims as any)?.email ?? null,
      provider: "epbx",
      connection_id: connection.id,
      call_type: "manual",
      status: "calling",
    };

    const { data: created, error } = await context.supabase
      .from("calls")
      .insert(insert as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const callId = created.id as string;

    try {
      const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "";
      const proto = getRequestHeader("x-forwarded-proto") ?? "https";
      const result = await getVoiceProvider("epbx").makeCall(creds, {
        to: data.phone,
        callerId: connection.default_caller_id ?? undefined,
        extension: connection.default_extension ?? undefined,
        webhookUrl: signedWebhookUrl(`${proto}://${host}`, callId),
      });
      await context.supabase.from("calls").update({ provider_call_sid: result.provider_call_id }).eq("id", callId);
      return { ok: true as const, callId, mode: "provider" as const };
    } catch (e) {
      const message = friendlyVoiceError(e);
      await context.supabase
        .from("calls")
        .update({ status: "failed", note: null, ended_at: new Date().toISOString() })
        .eq("id", callId);
      return { ok: false as const, reason: "failed" as const, message, callId };
    }
  });

export const getCall = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { callId: string }) => z.object({ callId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("calls")
      .select(SELECT)
      .eq("store_id", storeId)
      .eq("id", data.callId)
      .maybeSingle();
    return row ? shape(row) : null;
  });

const OutcomeSchema = z.object({
  callId: z.string().uuid(),
  status: z.enum(CALL_STATUSES as [CallStatus, ...CallStatus[]]).optional(),
  duration_sec: z.number().int().min(0).max(24 * 3600).optional(),
  result: z.enum(CALL_RESULTS as [string, ...string[]]).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const updateCallOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OutcomeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    const patch: Record<string, any> = {};
    if (data.status) {
      patch.status = data.status;
      if (!["calling", "ringing", "answered"].includes(data.status)) patch.ended_at = new Date().toISOString();
    }
    if (data.duration_sec != null) patch.duration_sec = data.duration_sec;
    if (data.result !== undefined) patch.result = data.result;
    if (data.note !== undefined) patch.note = data.note;
    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await context.supabase
      .from("calls")
      .update(patch as never)
      .eq("id", data.callId)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { callId: string }) => z.object({ callId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    await context.supabase.from("calls").delete().eq("id", data.callId).eq("store_id", storeId);
    return { ok: true };
  });

export const listCallRecordings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("calls")
      .select("id,customer_name,phone,status,result,duration_sec,recording_ref,call_type,created_at")
      .eq("store_id", storeId)
      .not("recording_ref", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as any[];
  });
