// Merchant voice provider + automation settings. Store always comes from the
// signed-in user; tokens are sealed server-side and never returned.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOwnedStoreId } from "@/lib/admin-order.server";
import { DEFAULT_VOICE_MESSAGES, DEFAULT_TTS_TEMPLATE } from "@/lib/voice/types";

async function ownStore(ctx: any) {
  const id = await getOwnedStoreId(ctx.supabase, ctx.userId);
  if (!id) throw new Error("Store not found");
  return id as string;
}

export const getVoiceConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { data } = await context.supabase
      .from("voice_provider_connections")
      .select("provider,token_preview,status,account_id,account_info,default_caller_id,default_extension,last_error,connected_at,last_tested_at")
      .eq("store_id", storeId).eq("provider", "epbx").maybeSingle();
    const { epbxProvider } = await import("@/lib/voice/epbx.server");
    const ready = epbxProvider.ready;
    return { connection: data ?? null, provider_ready: ready };
  });

const TokenSchema = z.object({ api_token: z.string().trim().min(8).max(500) });

async function runTest(token: string) {
  const { getVoiceProvider, friendlyVoiceError } = await import("@/lib/voice/service.server");
  try {
    const account = await getVoiceProvider("epbx").testConnection({ api_token: token });
    return { ok: true as const, account };
  } catch (e) {
    return { ok: false as const, message: friendlyVoiceError(e) };
  }
}

export const testVoiceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => TokenSchema.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await ownStore(context);
    const r = await runTest(data.api_token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditVoice } = await import("@/lib/voice/service.server");
    await auditVoice(supabaseAdmin, storeId, context.userId, "provider_tested", { ok: r.ok });
    return r.ok ? { ok: true, message: "Connection successful" } : { ok: false, message: r.message };
  });

export const connectVoiceProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => TokenSchema.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await ownStore(context);
    const r = await runTest(data.api_token);
    if (!r.ok) return { ok: false, message: r.message };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sealToken, newWebhookSecret, auditVoice } = await import("@/lib/voice/service.server");
    const sealed = sealToken(data.api_token);
    const hook = newWebhookSecret();
    const { data: prev } = await supabaseAdmin.from("voice_provider_connections")
      .select("account_info").eq("store_id", storeId).eq("provider", "epbx").maybeSingle();
    const keep = (prev as any)?.account_info?.saved_extensions;
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("voice_provider_connections").upsert({
      store_id: storeId, provider: "epbx", encrypted_token: sealed.enc, token_preview: sealed.preview,
      status: "connected", account_id: r.account.account_id ?? null, account_info: { ...(r.account as any), ...(keep ? { saved_extensions: keep } : {}) },
      webhook_secret_hash: hook.hash, last_error: null, connected_at: now, last_tested_at: now,
    }, { onConflict: "store_id,provider" });
    if (error) throw new Error("Could not save the connection. Please try again.");
    await auditVoice(supabaseAdmin, storeId, context.userId, "provider_connected", { provider: "epbx" });
    return { ok: true, message: "ePBX connected" };
  });

export const retestVoiceProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { openToken, auditVoice } = await import("@/lib/voice/service.server");
    const { data: row } = await supabaseAdmin.from("voice_provider_connections")
      .select("encrypted_token").eq("store_id", storeId).eq("provider", "epbx").maybeSingle();
    const creds = openToken((row as any)?.encrypted_token ?? null);
    if (!creds) return { ok: false, message: "ePBX is not connected." };
    const r = await runTest(creds.api_token);
    const { data: prev } = await supabaseAdmin.from("voice_provider_connections")
      .select("account_info").eq("store_id", storeId).eq("provider", "epbx").maybeSingle();
    await supabaseAdmin.from("voice_provider_connections").update({
      last_tested_at: new Date().toISOString(),
      status: r.ok ? "connected" : "error",
      last_error: r.ok ? null : r.message,
      ...(r.ok ? { account_info: { ...((prev as any)?.account_info ?? {}), ...(r.account as any) } } : {}),
    }).eq("store_id", storeId).eq("provider", "epbx");
    await auditVoice(supabaseAdmin, storeId, context.userId, "provider_tested", { ok: r.ok });
    return r.ok ? { ok: true, message: "Connection successful" } : { ok: false, message: r.message };
  });

export const disconnectVoiceProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditVoice } = await import("@/lib/voice/service.server");
    await supabaseAdmin.from("voice_provider_connections").update({
      encrypted_token: null, token_preview: null, webhook_secret_hash: null, status: "not_connected",
    }).eq("store_id", storeId).eq("provider", "epbx");
    await auditVoice(supabaseAdmin, storeId, context.userId, "provider_disconnected", { provider: "epbx" });
    return { ok: true };
  });

export const saveVoiceDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    default_caller_id: z.string().trim().max(20).regex(/^[0-9+]*$/),
    default_extension: z.string().trim().max(10).regex(/^[0-9]*$/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await ownStore(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.default_caller_id) {
      // Caller ID must be one ePBX reports for this account (no spoofing).
      const { data: row } = await supabaseAdmin.from("voice_provider_connections")
        .select("encrypted_token,status").eq("store_id", storeId).eq("provider", "epbx").maybeSingle();
      const { openToken, getVoiceProvider } = await import("@/lib/voice/service.server");
      const creds = (row as any)?.status === "connected" ? openToken((row as any).encrypted_token ?? null) : null;
      let allowed: string[] = [];
      if (creds) { try { allowed = (await getVoiceProvider("epbx").getNumbers(creds)).map((n: any) => n.number); } catch { /* ignore */ } }
      if (!allowed.includes(data.default_caller_id)) throw new Error("This caller ID is not active on your ePBX account.");
    }
    const { error } = await supabaseAdmin.from("voice_provider_connections").update({
      default_caller_id: data.default_caller_id || null, default_extension: data.default_extension || null,
    }).eq("store_id", storeId).eq("provider", "epbx");
    if (error) throw new Error("Could not save. Please try again.");
    const { auditVoice } = await import("@/lib/voice/service.server");
    await auditVoice(supabaseAdmin, storeId, context.userId, "defaults_changed");
    return { ok: true, message: "Saved" };
  });

export const saveVoiceExtensions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    extensions: z.array(z.object({
      extension: z.string().trim().regex(/^\d{2,6}$/),
      name: z.string().trim().max(40).optional(),
    })).max(20),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await ownStore(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("voice_provider_connections")
      .select("account_info,default_extension").eq("store_id", storeId).eq("provider", "epbx").maybeSingle();
    if (!row) throw new Error("Connect ePBX first.");
    const seen = new Set<string>();
    const list = data.extensions.filter((e) => !seen.has(e.extension) && seen.add(e.extension))
      .map((e) => ({ extension: e.extension, ...(e.name ? { name: e.name } : {}) }));
    const def = (row as any).default_extension;
    const { error } = await supabaseAdmin.from("voice_provider_connections").update({
      account_info: { ...((row as any).account_info ?? {}), saved_extensions: list } as any,
      ...(def && !seen.has(def) ? { default_extension: list[0]?.extension ?? null } : {}),
    }).eq("store_id", storeId).eq("provider", "epbx");
    if (error) throw new Error("Could not save. Please try again.");
    const { auditVoice } = await import("@/lib/voice/service.server");
    await auditVoice(supabaseAdmin, storeId, context.userId, "extensions_changed");
    return { ok: true };
  });

/* ----------------------------- automation ----------------------------- */

const AudioRef = z.string().trim().max(500).refine(
  (v) => v === "" || /^https:\/\/\S+$/i.test(v) || /^storage:[0-9a-f-]{36}\/[\w-]+\.mp3$/i.test(v),
  "Audio must be an https link or an uploaded MP3.",
);

const SettingsSchema = z.object({
  auto_call_enabled: z.boolean(),
  call_immediately: z.boolean(),
  delay_minutes: z.number().int().min(0).max(1440),
  retry_count: z.number().int().min(0).max(3),
  retry_delay_minutes: z.number().int().min(1).max(1440),
  business_hours_only: z.boolean(),
  hours_from: z.string().regex(/^\d{2}:\d{2}$/),
  hours_to: z.string().regex(/^\d{2}:\d{2}$/),
  manual_calling_enabled: z.boolean(),
  representative_transfer: z.boolean(),
  messages: z.record(z.string().max(40), z.string().max(500)),
  tts_template: z.string().max(600),
  confirm_text: z.string().max(300),
  cancel_text: z.string().max(300),
  main_audio_url: AudioRef, confirm_audio_url: AudioRef, cancel_audio_url: AudioRef,
  press2_action: z.enum(["cancel", "forward"]),
  sms_on_confirm: z.boolean(),
  retry_on_no_answer: z.boolean(),
  retry_on_no_keypress: z.boolean(),
});
export type VoiceSettings = z.infer<typeof SettingsSchema>;

export const getVoiceSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const { data } = await context.supabase.from("voice_automation_settings").select("*").eq("store_id", storeId).maybeSingle();
    const d: any = data ?? {};
    return {
      auto_call_enabled: d.auto_call_enabled ?? false,
      call_immediately: d.call_immediately ?? true,
      delay_minutes: d.delay_minutes ?? 0,
      retry_count: d.retry_count ?? 1,
      retry_delay_minutes: d.retry_delay_minutes ?? 30,
      business_hours_only: d.business_hours_only ?? true,
      hours_from: d.hours_from ?? "09:00",
      hours_to: d.hours_to ?? "22:00",
      manual_calling_enabled: d.manual_calling_enabled ?? true,
      representative_transfer: d.representative_transfer ?? true,
      messages: { ...DEFAULT_VOICE_MESSAGES, ...(d.messages ?? {}) },
      tts_template: d.tts_template ?? DEFAULT_TTS_TEMPLATE,
      confirm_text: d.confirm_text ?? "আপনার অর্ডারটি নিশ্চিত করা হয়েছে, ধন্যবাদ।",
      cancel_text: d.cancel_text ?? "আপনার অনুরোধ অনুযায়ী অর্ডারটি বাতিল করা হলো।",
      main_audio_url: d.main_audio_url ?? "",
      confirm_audio_url: d.confirm_audio_url ?? "",
      cancel_audio_url: d.cancel_audio_url ?? "",
      press2_action: d.press2_action === "forward" ? "forward" : "cancel",
      sms_on_confirm: d.sms_on_confirm ?? false,
      retry_on_no_answer: d.retry_on_no_answer ?? true,
      retry_on_no_keypress: d.retry_on_no_keypress ?? true,
    } as VoiceSettings;
  });

export const saveVoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await ownStore(context);
    for (const k of ["main_audio_url", "confirm_audio_url", "cancel_audio_url"] as const) {
      const v = data[k];
      if (v.startsWith("storage:") && !v.slice(8).startsWith(`${storeId}/`)) throw new Error("Invalid audio file.");
    }
    const row: any = { store_id: storeId, ...data };
    for (const k of ["main_audio_url", "confirm_audio_url", "cancel_audio_url"]) row[k] = row[k] || null;
    const { error } = await context.supabase.from("voice_automation_settings")
      .upsert(row, { onConflict: "store_id" });
    if (error) throw new Error("Could not save settings.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditVoice } = await import("@/lib/voice/service.server");
    await auditVoice(supabaseAdmin, storeId, context.userId, "automation_settings_changed");
    return { ok: true };
  });

/** Context for the Call Script editor: sample order for preview, SMS availability, default extension. */
export const getCallScriptContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownStore(context);
    const [{ data: store }, { data: order }, { data: conn }] = await Promise.all([
      context.supabase.from("stores").select("name,notifications").eq("id", storeId).maybeSingle(),
      context.supabase.from("orders").select("customer_name,invoice_no,subtotal").eq("store_id", storeId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      context.supabase.from("voice_provider_connections").select("default_extension").eq("store_id", storeId).eq("provider", "epbx").maybeSingle(),
    ]);
    const sms: any = (store as any)?.notifications?.sms;
    return {
      storeId,
      sample: {
        customer_name: (order as any)?.customer_name ?? "রহিম",
        store_name: (store as any)?.name ?? "আপনার স্টোর",
        amount: String(Math.round(Number((order as any)?.subtotal ?? 1250))),
        order_id: (order as any)?.invoice_no ?? "1001",
      },
      sms_ready: !!(sms?.enabled && sms?.sender_id),
      default_extension: (conn as any)?.default_extension ?? null,
    };
  });
