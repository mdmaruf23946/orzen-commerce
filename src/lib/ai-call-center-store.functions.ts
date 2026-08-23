// Store-admin server functions for the AI Voice Call Center.
// Everything is scoped to the signed-in store owner's store; no platform
// credentials, agent ids, prompts or webhook details are ever returned.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getOwnedStoreId } from "@/lib/admin-order.server";

async function storeIdOrThrow(supabase: any, userId: string) {
  const id = await getOwnedStoreId(supabase, userId);
  if (!id) throw new Error("Store not found");
  return id as string;
}

/** AI Call Center access is granted by the store's subscription plan. */
async function planAllowsAiCalls(supabase: any, storeId: string) {
  const { data } = await supabase
    .from("stores")
    .select("subscription_status, subscription_packages(is_trial, features)")
    .eq("id", storeId)
    .maybeSingle();
  const status = (data as any)?.subscription_status ?? "active";
  if (["expired", "suspended", "cancelled"].includes(status)) return false;
  const pkg = (data as any)?.subscription_packages;
  if (!pkg) return false;
  return pkg.is_trial === true || pkg.features?.ai_call_center === true;
}

/** Everything the setup wizard needs: status plus the approved choices. */
export const getStoreAiCallSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const storeId = await storeIdOrThrow(sb, context.userId);

    const [{ data: settings }, { data: numbers }, { data: voices }, tones] = await Promise.all([
      sb.from("store_ai_call_settings").select("*").eq("store_id", storeId).maybeSingle(),
      sb
        .from("ai_phone_numbers")
        .select("id,phone_number,country,inbound_enabled,outbound_enabled,status")
        .eq("store_id", storeId)
        .order("created_at"),
      sb
        .from("ai_call_voices")
        .select("id,name,gender,language,accent,description,preview_url")
        .eq("is_active", true)
        .order("sort_order")
        .order("name"),
      sb.rpc("list_ai_call_tones_public"),
    ]);

    const s: any = settings;
    return {
      storeId,
      feature_enabled: await planAllowsAiCalls(sb, storeId),
      is_active: !!s?.is_active,
      selection: s
        ? {
            phone_number_id: s.phone_number_id,
            voice_id: s.voice_id,
            tone_id: s.tone_id,
            gender: s.gender,
            inbound_enabled: s.inbound_enabled,
            outbound_enabled: s.outbound_enabled,
            auto_confirm_orders: s.auto_confirm_orders,
            activated_at: s.activated_at,
            last_error: s.last_error,
          }
        : null,
      numbers: numbers ?? [],
      voices: voices ?? [],
      tones: (tones as any)?.data ?? [],
    };
  });

export const activateStoreAiCallCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        phone_number_id: z.string().uuid(),
        voice_id: z.string().uuid(),
        tone_id: z.string().uuid(),
        gender: z.enum(["female", "male"]),
        auto_confirm_orders: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const storeId = await storeIdOrThrow(sb, context.userId);

    if (!(await planAllowsAiCalls(sb, storeId))) {
      throw new Error("AI Call Center is not included in your current plan. Please upgrade to continue.");
    }

    // The chosen number must be one made available to this store.
    const { data: num } = await sb
      .from("ai_phone_numbers")
      .select("id")
      .eq("id", data.phone_number_id)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!num) throw new Error("Please choose one of your available phone numbers.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { provisionStoreAgent } = await import("@/lib/ai-call-provision.server");

    try {
      const { agentRowId } = await provisionStoreAgent(supabaseAdmin, {
        storeId,
        voiceId: data.voice_id,
        toneId: data.tone_id,
        gender: data.gender,
        phoneNumberId: data.phone_number_id,
      });
      await supabaseAdmin.from("store_ai_call_settings").upsert(
        {
          store_id: storeId,
          is_active: true,
          phone_number_id: data.phone_number_id,
          agent_id: agentRowId,
          voice_id: data.voice_id,
          tone_id: data.tone_id,
          gender: data.gender,
          auto_confirm_orders: data.auto_confirm_orders,
          activated_at: new Date().toISOString(),
          last_error: null,
        } as never,
        { onConflict: "store_id" },
      );
      return { ok: true as const };
    } catch (e: any) {
      const message = "We could not activate AI calling right now. Please try again shortly.";
      await supabaseAdmin
        .from("store_ai_call_settings")
        .upsert(
          { store_id: storeId, is_active: false, last_error: String(e?.message ?? e).slice(0, 400) } as never,
          { onConflict: "store_id" },
        );
      return { ok: false as const, error: message };
    }
  });

export const setStoreAiCallActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const storeId = await storeIdOrThrow(sb, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("store_ai_call_settings")
      .update({ is_active: data.active } as never)
      .eq("store_id", storeId);
    return { ok: true };
  });

export const updateStoreAiCallPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        inbound_enabled: z.boolean().optional(),
        outbound_enabled: z.boolean().optional(),
        auto_confirm_orders: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const storeId = await storeIdOrThrow(sb, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("store_ai_call_settings").update(data as never).eq("store_id", storeId);
    return { ok: true };
  });

export const storeAiCallOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const storeId = await storeIdOrThrow(sb, context.userId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await sb
      .from("ai_calls")
      .select("direction,status,result,duration_sec")
      .eq("store_id", storeId)
      .gte("created_at", start.toISOString());
    const rows = (data ?? []) as any[];
    const c = (fn: (r: any) => boolean) => rows.filter(fn).length;
    return {
      today: rows.length,
      inbound: c((r) => r.direction === "inbound"),
      outbound: c((r) => r.direction === "outbound"),
      confirmed: c((r) => r.result === "confirmed"),
      cancelled: c((r) => r.result === "cancelled"),
      no_answer: c((r) => r.result === "no_answer" || r.status === "no_answer"),
      minutes: Math.round(rows.reduce((a, r) => a + Number(r.duration_sec ?? 0), 0) / 60),
    };
  });

export const listStoreAiCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        direction: z.enum(["all", "inbound", "outbound"]).default("all"),
        search: z.string().trim().max(60).default(""),
        limit: z.number().int().min(1).max(100).default(30),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const storeId = await storeIdOrThrow(sb, context.userId);
    let q = sb
      .from("ai_calls")
      .select("id,order_id,direction,customer_name,phone,status,result,duration_sec,created_at,orders(invoice_no)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.direction !== "all") q = q.eq("direction", data.direction);
    if (data.search) q = q.or(`customer_name.ilike.%${data.search}%,phone.ilike.%${data.search}%`);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const getStoreAiCall = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ callId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const storeId = await storeIdOrThrow(sb, context.userId);
    const { data: call } = await sb
      .from("ai_calls")
      .select(
        "id,order_id,direction,customer_name,phone,status,result,duration_sec,summary,recording_url,created_at,started_at,ended_at,orders(invoice_no)",
      )
      .eq("id", data.callId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!call) throw new Error("Call not found");
    const { data: transcript } = await sb
      .from("ai_call_transcripts")
      .select("role,message,seq")
      .eq("call_id", data.callId)
      .eq("store_id", storeId)
      .order("seq");
    return { call, transcript: transcript ?? [] };
  });
