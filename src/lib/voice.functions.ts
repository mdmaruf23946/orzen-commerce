// Merchant voice provider + automation settings. Store always comes from the
// signed-in user; tokens are sealed server-side and never returned.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOwnedStoreId } from "@/lib/admin-order.server";
import { DEFAULT_VOICE_MESSAGES } from "@/lib/voice/types";

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
    const { ready } = { ready: false };
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
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("voice_provider_connections").upsert({
      store_id: storeId, provider: "epbx", encrypted_token: sealed.enc, token_preview: sealed.preview,
      status: "connected", account_id: r.account.account_id ?? null, account_info: r.account as any,
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
    await supabaseAdmin.from("voice_provider_connections").update({
      last_tested_at: new Date().toISOString(),
      status: r.ok ? "connected" : "error",
      last_error: r.ok ? null : r.message,
      ...(r.ok ? { account_info: r.account as any } : {}),
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

/* ----------------------------- automation ----------------------------- */

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
      business_hours_only: d.business_hours_only ?? false,
      hours_from: d.hours_from ?? "09:00",
      hours_to: d.hours_to ?? "21:00",
      manual_calling_enabled: d.manual_calling_enabled ?? true,
      representative_transfer: d.representative_transfer ?? true,
      messages: { ...DEFAULT_VOICE_MESSAGES, ...(d.messages ?? {}) },
    } as VoiceSettings;
  });

export const saveVoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const storeId = await ownStore(context);
    const { error } = await context.supabase.from("voice_automation_settings")
      .upsert({ store_id: storeId, ...data }, { onConflict: "store_id" });
    if (error) throw new Error("Could not save settings.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditVoice } = await import("@/lib/voice/service.server");
    await auditVoice(supabaseAdmin, storeId, context.userId, "automation_settings_changed");
    return { ok: true };
  });
