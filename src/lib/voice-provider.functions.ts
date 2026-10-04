// Live data from the merchant's connected calling provider (account, numbers, call log,
// extensions seen in the log). Store always comes from the signed-in user; the token
// is opened server-side only and never returned.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOwnedStoreId } from "@/lib/admin-order.server";

async function ctxCreds(context: any) {
  const storeId = await getOwnedStoreId(context.supabase, context.userId);
  if (!storeId) throw new Error("Store not found");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await (supabaseAdmin as any).from("voice_provider_connections")
    .select("provider,status,encrypted_token,default_caller_id,default_extension,last_tested_at")
    .eq("store_id", storeId).eq("provider", "epbx").maybeSingle();
  const { openToken, getVoiceProvider, friendlyVoiceError } = await import("@/lib/voice/service.server");
  const creds = row?.status === "connected" ? openToken(row.encrypted_token ?? null) : null;
  return { storeId, row, creds, provider: getVoiceProvider("epbx"), friendlyVoiceError };
}

export const getProviderOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { row, creds, provider, friendlyVoiceError } = await ctxCreds(context);
    const base = {
      provider: provider.label,
      capabilities: provider.capabilities,
      default_caller_id: row?.default_caller_id ?? null,
      default_extension: row?.default_extension ?? null,
    };
    if (!creds) return { ...base, connected: false as const };
    const started = Date.now();
    try {
      const o = await provider.getOverview(creds);
      return { ...base, connected: true as const, healthy: true, latency_ms: Date.now() - started, synced_at: new Date().toISOString(), ...o };
    } catch (e) {
      return { ...base, connected: true as const, healthy: false, error: friendlyVoiceError(e), synced_at: new Date().toISOString() };
    }
  });

const CdrSchema = z.object({
  direction: z.enum(["all", "incoming", "outgoing"]).default("all"),
  disposition: z.enum(["", "ANSWERED", "NO ANSWER", "BUSY", "FAILED"]).default(""),
  phone: z.string().trim().regex(/^[0-9+]*$/).max(20).default(""),
  extension: z.string().trim().regex(/^\d*$/).max(6).default(""),
  days: z.number().int().min(1).max(90).default(7),
  page: z.number().int().min(1).max(500).default(1),
});

export const listProviderCallLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CdrSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { storeId, creds, provider, friendlyVoiceError } = await ctxCreds(context);
    if (!creds) return { connected: false as const, rows: [], page: 1, last_page: 1, total: 0 };
    const day = (d: Date) => new Date(d.getTime() + 6 * 3600e3).toISOString().slice(0, 10); // Dhaka date
    try {
      const r = await provider.getCallHistory(creds, {
        start_date: day(new Date(Date.now() - (data.days - 1) * 86400e3)),
        end_date: day(new Date()),
        phone_number: data.phone || undefined,
        extension: data.extension || undefined,
        disposition: data.disposition || undefined,
        page: data.page, per_page: 50,
      });
      const { signedCdrRecordingPath } = await import("@/lib/voice/queue.server");
      const rows = r.rows
        .filter((x) => data.direction === "all" || x.direction === data.direction)
        .map((x) => ({ ...x, play_url: x.has_recording ? signedCdrRecordingPath(storeId, x.id) : null }));
      return { connected: true as const, rows, page: r.page, last_page: r.last_page, total: r.total };
    } catch (e) {
      return { connected: true as const, rows: [], page: 1, last_page: 1, total: 0, error: friendlyVoiceError(e) };
    }
  });

/** Extensions are not listable through the ePBX API; we report the saved default plus those seen in the last 30 days of calls. */
export const listProviderExtensions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { row, creds, provider, friendlyVoiceError } = await ctxCreds(context);
    const def = row?.default_extension ?? null;
    if (!creds) return { connected: false as const, list_supported: provider.capabilities.extensions_list, extensions: [] as any[] };
    const map = new Map<string, { extension: string; calls: number; last_call: string | null; is_default: boolean }>();
    if (def) map.set(def, { extension: def, calls: 0, last_call: null, is_default: true });
    let error: string | undefined;
    try {
      const day = (d: Date) => new Date(d.getTime() + 6 * 3600e3).toISOString().slice(0, 10);
      const r = await provider.getCallHistory(creds, {
        start_date: day(new Date(Date.now() - 29 * 86400e3)), end_date: day(new Date()), page: 1, per_page: 100,
      });
      for (const c of r.rows) {
        for (const v of [c.source, c.destination]) {
          if (!/^\d{2,6}$/.test(v)) continue;
          const e = map.get(v) ?? { extension: v, calls: 0, last_call: null, is_default: v === def };
          e.calls++;
          if (!e.last_call || c.date > e.last_call) e.last_call = c.date;
          map.set(v, e);
        }
      }
    } catch (e) { error = friendlyVoiceError(e); }
    return {
      connected: true as const,
      list_supported: provider.capabilities.extensions_list,
      extensions: [...map.values()].sort((a, b) => a.extension.localeCompare(b.extension)),
      error,
    };
  });

export const listAutomatedOrderCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await getOwnedStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("Store not found");
    const [{ data: calls }, { data: queue }] = await Promise.all([
      context.supabase.from("calls")
        .select("id,order_id,customer_name,phone,status,result,duration_sec,retry_count,created_at,orders(invoice_no)")
        .eq("store_id", storeId).eq("call_type", "auto_verification")
        .order("created_at", { ascending: false }).limit(50),
      (context.supabase as any).from("voice_call_queue")
        .select("order_id,status,attempt,run_at,last_error")
        .eq("store_id", storeId).order("created_at", { ascending: false }).limit(100),
    ]);
    const q = new Map<string, any>();
    for (const j of (queue ?? []) as any[]) if (!q.has(j.order_id)) q.set(j.order_id, j);
    return ((calls ?? []) as any[]).map((c) => {
      const j = c.order_id ? q.get(c.order_id) : null;
      return {
        id: c.id, invoice_no: c.orders?.invoice_no ?? null, customer_name: c.customer_name, phone: c.phone,
        status: c.status, result: c.result, duration_sec: c.duration_sec, attempt: (c.retry_count ?? 0) + 1,
        created_at: c.created_at,
        retry: j ? { status: j.status, next_at: j.status === "queued" ? j.run_at : null } : null,
      };
    });
  });
