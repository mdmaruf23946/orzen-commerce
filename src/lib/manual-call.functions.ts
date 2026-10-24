import { pgSafe } from "@/lib/pg-filter";
// Manual Call (beta): merchants connect their own SIP/IP-phone line to a
// Winner-Admin-managed gateway and call customers from the browser.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { myStoreRow } from "@/lib/store-access";

async function storeIdFor(sb: any, userId: string) {
  const row = await myStoreRow(sb, userId, "id");
  if (!row) throw new Error("Store not found");
  return row.id as string;
}

async function assertOwner(sb: any, userId: string) {
  const { data } = await sb.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (!data) throw new Error("Forbidden");
}

const mask = (l: any) => ({ ...l, sip_password: l.sip_password ? "••••••" : "" });

// ---------- Gateways (Winner Admin) ----------
export const listManualGateways = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("manual_call_gateways").select("*").order("created_at");
    return data ?? [];
  });

export const saveManualGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(80),
      kind: z.enum(["sip", "mobile", "ip"]).default("sip"),
      wss_url: z.string().trim().url().max(300).refine((u) => u.startsWith("wss://"), "Must start with wss://"),
      sip_domain: z.string().trim().min(1).max(200),
      help_text: z.string().trim().max(1000).optional().nullable(),
      is_active: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { id, ...row } = data;
    const q = id
      ? context.supabase.from("manual_call_gateways").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id)
      : context.supabase.from("manual_call_gateways").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteManualGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("manual_call_gateways").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Merchant lines ----------
export const listManualLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const [{ data: lines }, { data: gateways }] = await Promise.all([
      context.supabase.from("manual_call_lines").select("*").eq("store_id", storeId).order("created_at"),
      context.supabase.from("manual_call_gateways").select("id,name,kind,sip_domain,help_text").eq("is_active", true).order("name"),
    ]);
    return { storeId, lines: (lines ?? []).map(mask), gateways: gateways ?? [] };
  });

export const saveManualLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      gateway_id: z.string().uuid(),
      label: z.string().trim().min(1).max(60),
      caller_number: z.string().trim().max(30).optional().nullable(),
      sip_username: z.string().trim().min(1).max(120),
      sip_password: z.string().max(200).optional(),
      extension: z.string().trim().max(30).optional().nullable(),
      is_default: z.boolean().default(false),
      record_calls: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const storeId = await storeIdFor(sb, context.userId);
    const { id, sip_password, ...rest } = data;
    const row: any = { ...rest, store_id: storeId, updated_at: new Date().toISOString() };
    if (sip_password && sip_password !== "••••••") row.sip_password = sip_password;
    if (!id && !row.sip_password) throw new Error("Password is required");
    if (row.is_default) await sb.from("manual_call_lines").update({ is_default: false }).eq("store_id", storeId);
    const { error } = id
      ? await sb.from("manual_call_lines").update(row).eq("id", id).eq("store_id", storeId)
      : await sb.from("manual_call_lines").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteManualLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    await context.supabase.from("manual_call_lines").delete().eq("id", data.id).eq("store_id", storeId);
    return { ok: true };
  });

/** Full credentials for the browser phone — only for the caller's own store. */
export const getManualLineCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const { data: line } = await context.supabase
      .from("manual_call_lines")
      .select("id,sip_username,sip_password,extension,caller_number,record_calls,manual_call_gateways(wss_url,sip_domain,is_active)")
      .eq("id", data.id).eq("store_id", storeId).maybeSingle();
    const gw: any = (line as any)?.manual_call_gateways;
    if (!line || !gw?.is_active) throw new Error("Line or gateway is not available");
    return {
      wss_url: gw.wss_url as string,
      sip_domain: gw.sip_domain as string,
      username: line.sip_username,
      password: line.sip_password,
      extension: line.extension,
      caller_number: line.caller_number,
      record: line.record_calls,
    };
  });

// ---------- Call log ----------
export const startManualCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      line_id: z.string().uuid(),
      phone: z.string().trim().min(3).max(30),
      customer_name: z.string().trim().max(120).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("manual_calls")
      .insert({ ...data, store_id: storeId, user_id: context.userId, status: "dialing" })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, storeId };
  });

export const updateManualCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["dialing", "ringing", "answered", "completed", "missed", "failed", "busy"]).optional(),
      answered: z.boolean().optional(),
      ended: z.boolean().optional(),
      duration_sec: z.number().int().min(0).max(86400).optional(),
      recording_path: z.string().max(300).optional(),
      notes: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const now = new Date().toISOString();
    const patch: any = {};
    if (data.status) patch.status = data.status;
    if (data.answered) patch.answered_at = now;
    if (data.ended) patch.ended_at = now;
    if (data.duration_sec !== undefined) patch.duration_sec = data.duration_sec;
    if (data.recording_path) {
      if (!data.recording_path.startsWith(`manual/${storeId}/`)) throw new Error("Invalid recording");
      patch.recording_path = data.recording_path;
    }
    if (data.notes !== undefined) patch.notes = data.notes;
    await context.supabase.from("manual_calls").update(patch).eq("id", data.id).eq("store_id", storeId);
    return { ok: true };
  });

export const listManualCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ search: z.string().trim().max(60).optional(), status: z.string().max(20).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const storeId = await storeIdFor(sb, context.userId);
    let q = sb.from("manual_calls").select("*").eq("store_id", storeId).order("started_at", { ascending: false }).limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.search) q = q.or(`phone.ilike.%${pgSafe(data.search.replace(/[,%()]/g, ""))}%,customer_name.ilike.%${pgSafe(data.search.replace(/[,%()]/g, ""))}%`);
    const { data: calls } = await q;
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: recent } = await sb.from("manual_calls").select("status,duration_sec,started_at").eq("store_id", storeId).gte("started_at", since);
    const r = recent ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const answered = r.filter((c: any) => c.status === "completed" || c.status === "answered");
    const talk = answered.reduce((s: number, c: any) => s + (c.duration_sec || 0), 0);
    return {
      calls: calls ?? [],
      stats: {
        total30: r.length,
        today: r.filter((c: any) => String(c.started_at).startsWith(today)).length,
        answerRate: r.length ? Math.round((answered.length / r.length) * 100) : 0,
        talkSec: talk,
        avgSec: answered.length ? Math.round(talk / answered.length) : 0,
        missed: r.filter((c: any) => ["missed", "failed", "busy"].includes(c.status)).length,
      },
    };
  });

export const manualRecordingUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const { data: c } = await context.supabase.from("manual_calls").select("recording_path").eq("id", data.id).eq("store_id", storeId).maybeSingle();
    if (!c?.recording_path) throw new Error("No recording");
    const { data: s, error } = await context.supabase.storage.from("voice-audio").createSignedUrl(c.recording_path, 600);
    if (error) throw new Error(error.message);
    return { url: s.signedUrl };
  });

/** Save/merge a browser-dialed call (provider configs live in the browser) so
 *  history follows the account across browsers/devices. Store-scoped. */
export const saveCallLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      phone: z.string().trim().max(30).optional(),
      provider_id: z.string().trim().max(40).optional(),
      status: z.enum(["completed", "missed", "failed", "busy"]).optional(),
      duration_sec: z.number().int().min(0).max(86400).optional(),
      started_at: z.string().max(40).optional(),
      recording_path: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const storeId = await storeIdFor(sb, context.userId);
    if (data.recording_path && !data.recording_path.startsWith(`manual/${storeId}/`)) throw new Error("Invalid recording");
    const { data: existing } = await sb.from("manual_calls").select("id").eq("id", data.id).eq("store_id", storeId).maybeSingle();
    const patch: any = {};
    if (data.status) { patch.status = data.status; patch.ended_at = new Date().toISOString(); }
    if (data.duration_sec !== undefined) patch.duration_sec = data.duration_sec;
    if (data.recording_path) patch.recording_path = data.recording_path;
    if (data.provider_id) patch.notes = `provider:${data.provider_id}`;
    if (existing) {
      const { error } = await sb.from("manual_calls").update(patch).eq("id", data.id).eq("store_id", storeId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("manual_calls").insert({
        ...patch, id: data.id, store_id: storeId, user_id: context.userId,
        phone: data.phone || "unknown", status: data.status || "completed",
        started_at: data.started_at || new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
