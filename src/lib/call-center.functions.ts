// Manual Call Center server functions: provider settings, call logging and
// one-click calling. All reads/writes are scoped to the signed-in store owner.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getOwnedStoreId } from "@/lib/admin-order.server";
import {
  CALL_STATUSES, CALL_RESULTS, type CallProvider, type CallRow, type CallStatus,
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

/* ------------------------------- provider ------------------------------- */

export const getCallProvider = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("call_provider_settings")
      .select("provider,credentials_preview,caller_id,status,last_error,is_active,updated_at")
      .eq("store_id", storeId)
      .maybeSingle();
    const row: any = data ?? {};
    return {
      provider: (row.provider ?? "device") as CallProvider,
      caller_id: row.caller_id ?? "",
      credentials_preview: row.credentials_preview ?? null,
      has_credentials: !!row.credentials_preview,
      status: (row.status ?? "not_connected") as "connected" | "not_connected" | "error",
      last_error: row.last_error ?? null,
      is_active: row.is_active ?? true,
      updated_at: row.updated_at ?? null,
    };
  });

const SaveProviderSchema = z.object({
  provider: z.enum(["device", "twilio"]),
  caller_id: z.string().trim().max(40).default(""),
  agent_phone: z.string().trim().max(40).default(""),
  account_sid: z.string().trim().max(120).optional().nullable(),
  auth_token: z.string().trim().max(200).optional().nullable(),
});

export const saveCallProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveProviderSchema.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    const { encryptCreds, readCreds } = await import("@/lib/call-center.server");

    const { data: existing } = await context.supabase
      .from("call_provider_settings")
      .select("credentials_encrypted,credentials_preview")
      .eq("store_id", storeId)
      .maybeSingle();

    const patch: Record<string, any> = {
      store_id: storeId,
      provider: data.provider,
      caller_id: data.caller_id,
      is_active: true,
      last_error: null,
    };

    if (data.provider === "twilio") {
      const prev = readCreds<Record<string, string>>((existing as any)?.credentials_encrypted) ?? {};
      const creds = {
        account_sid: data.account_sid || prev.account_sid || "",
        auth_token: data.auth_token || prev.auth_token || "",
        agent_phone: data.agent_phone || prev.agent_phone || "",
      };
      if (!creds.account_sid || !creds.auth_token) throw new Error("Account SID and Auth Token are required.");
      if (!data.caller_id) throw new Error("A caller ID / business number is required.");
      const { enc, preview } = encryptCreds(creds);
      patch.credentials_encrypted = enc;
      patch.credentials_preview = preview;
      patch.status = "connected";
    } else {
      patch.status = "connected";
      if (data.agent_phone) {
        const { enc, preview } = encryptCreds({ agent_phone: data.agent_phone });
        patch.credentials_encrypted = enc;
        patch.credentials_preview = preview;
      }
    }

    const { error } = await context.supabase
      .from("call_provider_settings")
      .upsert(patch as never, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testCallProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("call_provider_settings")
      .select("provider,credentials_encrypted,caller_id")
      .eq("store_id", storeId)
      .maybeSingle();
    const settings: any = row ?? {};
    if (!settings.provider) throw new Error("Calling provider is not connected.");

    let error: string | null = null;
    if (settings.provider === "twilio") {
      const { readCreds, twilioVerify } = await import("@/lib/call-center.server");
      const creds = readCreds<any>(settings.credentials_encrypted);
      if (!creds?.account_sid || !creds?.auth_token) error = "Credentials are missing. Please re-enter them.";
      else {
        try {
          await twilioVerify(creds);
        } catch (e: any) {
          error = e?.message ?? "The calling provider could not be reached.";
        }
      }
    }

    await context.supabase
      .from("call_provider_settings")
      .update({ status: error ? "error" : "connected", last_error: error })
      .eq("store_id", storeId);
    return { ok: !error, error };
  });

export const disconnectCallProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await storeIdOrThrow(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("call_provider_settings")
      .update({
        status: "not_connected",
        credentials_encrypted: null,
        credentials_preview: null,
        is_active: false,
        last_error: null,
      })
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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
    const { data: settingsRow } = await context.supabase
      .from("call_provider_settings")
      .select("provider,credentials_encrypted,caller_id,status,is_active")
      .eq("store_id", storeId)
      .maybeSingle();
    const settings: any = settingsRow ?? null;
    if (!settings || !settings.is_active || settings.status === "not_connected") {
      return { ok: false as const, reason: "not_connected" as const };
    }

    const { readCreds } = await import("@/lib/call-center.server");
    const creds = readCreds<any>(settings.credentials_encrypted) ?? {};
    const provider: CallProvider = settings.provider === "twilio" ? "twilio" : "device";

    const insert: Record<string, any> = {
      store_id: storeId,
      order_id: data.order_id ?? null,
      customer_id: data.customer_id ?? null,
      customer_name: data.customer_name ?? null,
      phone: data.phone,
      agent_id: context.userId,
      agent_email: (context.claims as any)?.email ?? null,
      provider,
      status: "calling",
    };

    const { data: created, error } = await context.supabase
      .from("calls")
      .insert(insert as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const callId = created.id as string;

    if (provider === "device") {
      return { ok: true as const, callId, mode: "device" as const, dial: data.phone };
    }

    try {
      if (!creds.agent_phone) throw new Error("Add your agent phone number in the provider settings first.");
      const { twilioStartCall } = await import("@/lib/call-center.server");
      const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "";
      const proto = getRequestHeader("x-forwarded-proto") ?? "https";
      const statusCallbackUrl = `${proto}://${host}/api/public/calls/twilio-status/${storeId}`;
      const sid = await twilioStartCall({
        creds: { account_sid: creds.account_sid, auth_token: creds.auth_token },
        callerId: settings.caller_id,
        agentPhone: creds.agent_phone,
        customerPhone: data.phone,
        statusCallbackUrl,
      });
      await context.supabase.from("calls").update({ provider_call_sid: sid }).eq("id", callId);
      return { ok: true as const, callId, mode: "provider" as const, dial: null };
    } catch (e: any) {
      const message = e?.message ?? "The call could not be started.";
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
