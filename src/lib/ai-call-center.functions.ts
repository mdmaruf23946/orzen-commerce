// Owner-only server functions for the AI Voice Call Center.
// Credentials never leave the server; only masked previews are returned.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const uuid = z.string().uuid();

/* -------------------------------- config -------------------------------- */

export const getAiCallConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("ai_call_config")
      .select(
        "id,elevenlabs_preview,elevenlabs_status,elevenlabs_last_error,twilio_preview,twilio_status,twilio_last_error,default_agent_id,default_voice_id,default_language,default_gender,default_tone_id,default_instructions,default_caller_id,calling_region,behavior,rules,business,tools,updated_at",
      )
      .eq("id", "global")
      .maybeSingle();
    return data ?? null;
  });

export const saveElevenLabsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        api_key: z.string().trim().max(300).default(""),
        webhook_secret: z.string().trim().max(300).default(""),
        default_voice_id: z.string().uuid().nullable().default(null),
        default_tone_id: z.string().uuid().nullable().default(null),
        default_language: z.string().trim().max(20).default("en"),
        default_gender: z.enum(["female", "male"]).default("female"),
        default_instructions: z.string().max(6000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const patch: Record<string, unknown> = {
      default_voice_id: data.default_voice_id,
      default_tone_id: data.default_tone_id,
      default_language: data.default_language,
      default_gender: data.default_gender,
      default_instructions: data.default_instructions,
    };
    if (data.api_key) {
      const { encryptCreds } = await import("@/lib/ai-call-center.server");
      const { enc, preview } = encryptCreds({
        api_key: data.api_key,
        webhook_secret: data.webhook_secret || "",
      });
      patch["elevenlabs_credentials"] = enc;
      patch["elevenlabs_preview"] = preview;
      patch["elevenlabs_status"] = "not_connected";
      patch["elevenlabs_last_error"] = null;
    } else if (data.webhook_secret) {
      const { readCreds, encryptCreds } = await import("@/lib/ai-call-center.server");
      const { data: row } = await context.supabase
        .from("ai_call_config")
        .select("elevenlabs_credentials")
        .eq("id", "global")
        .maybeSingle();
      const cur = readCreds<any>((row as any)?.elevenlabs_credentials) ?? {};
      const { enc, preview } = encryptCreds({ ...cur, webhook_secret: data.webhook_secret });
      patch["elevenlabs_credentials"] = enc;
      patch["elevenlabs_preview"] = preview;
    }
    const { error } = await context.supabase.from("ai_call_config").update(patch as never).eq("id", "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveTwilioSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        account_sid: z.string().trim().max(120).default(""),
        auth_token: z.string().trim().max(200).default(""),
        default_caller_id: z.string().trim().max(30).default(""),
        calling_region: z.string().trim().max(20).default("us1"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const patch: Record<string, unknown> = {
      default_caller_id: data.default_caller_id,
      calling_region: data.calling_region,
    };
    if (data.account_sid && data.auth_token) {
      const { encryptCreds } = await import("@/lib/ai-call-center.server");
      const { enc, preview } = encryptCreds({
        account_sid: data.account_sid,
        auth_token: data.auth_token,
      });
      patch["twilio_credentials"] = enc;
      patch["twilio_preview"] = preview;
      patch["twilio_status"] = "not_connected";
      patch["twilio_last_error"] = null;
    }
    const { error } = await context.supabase.from("ai_call_config").update(patch as never).eq("id", "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ provider: z.enum(["elevenlabs", "twilio"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("ai_call_config")
      .select("elevenlabs_credentials,twilio_credentials")
      .eq("id", "global")
      .maybeSingle();
    const { readCreds, elVerify, twilioVerify } = await import("@/lib/ai-call-center.server");

    const isEl = data.provider === "elevenlabs";
    const creds = readCreds<any>(
      isEl ? (row as any)?.elevenlabs_credentials : (row as any)?.twilio_credentials,
    );
    const statusCol = isEl ? "elevenlabs_status" : "twilio_status";
    const errorCol = isEl ? "elevenlabs_last_error" : "twilio_last_error";

    if (!creds) {
      await context.supabase
        .from("ai_call_config")
        .update({ [statusCol]: "not_connected", [errorCol]: "No credentials saved yet." } as never)
        .eq("id", "global");
      return { ok: false, error: "No credentials saved yet." };
    }
    try {
      if (isEl) await elVerify(creds);
      else await twilioVerify(creds);
      await context.supabase
        .from("ai_call_config")
        .update({ [statusCol]: "connected", [errorCol]: null } as never)
        .eq("id", "global");
      return { ok: true };
    } catch (e: any) {
      const msg = isEl ? "Unable to connect to ElevenLabs" : "Unable to connect to Twilio";
      await context.supabase
        .from("ai_call_config")
        .update({ [statusCol]: "error", [errorCol]: String(e?.message ?? msg).slice(0, 500) } as never)
        .eq("id", "global");
      return { ok: false, error: msg };
    }
  });

export const saveAiCallRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        behavior: z.record(z.string(), z.any()).optional(),
        rules: z.record(z.string(), z.any()).optional(),
        business: z.record(z.string(), z.any()).optional(),
        tools: z.record(z.string(), z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    for (const k of ["behavior", "rules", "business", "tools"] as const) {
      if (data[k]) patch[k] = data[k];
    }
    const { error } = await context.supabase.from("ai_call_config").update(patch as never).eq("id", "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------- voices --------------------------------- */

export const listVoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("ai_call_voices")
      .select("*")
      .order("sort_order")
      .order("name");
    return data ?? [];
  });

export const saveVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().nullable().default(null),
        name: z.string().trim().min(1).max(80),
        elevenlabs_voice_id: z.string().trim().min(1).max(80),
        gender: z.enum(["female", "male"]).default("female"),
        language: z.string().trim().max(20).default("en"),
        accent: z.string().trim().max(40).default(""),
        tone: z.string().trim().max(40).default(""),
        description: z.string().trim().max(300).default(""),
        speed: z.number().min(0.5).max(2).default(1),
        preview_url: z.string().trim().max(500).default(""),
        is_active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { id, ...row } = data;
    if (id) {
      const { error } = await context.supabase.from("ai_call_voices").update(row as never).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true, id };
    }
    const { data: created, error } = await context.supabase
      .from("ai_call_voices")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (created as any).id };
  });

export const deleteVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("ai_call_voices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pull the account's ElevenLabs voices so the owner can add them quickly. */
export const importElevenLabsVoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("ai_call_config")
      .select("elevenlabs_credentials")
      .eq("id", "global")
      .maybeSingle();
    const { readCreds, elListVoices } = await import("@/lib/ai-call-center.server");
    const creds = readCreds<any>((row as any)?.elevenlabs_credentials);
    if (!creds) throw new Error("Save the ElevenLabs API key first.");
    const voices = await elListVoices(creds);
    const { data: existing } = await context.supabase.from("ai_call_voices").select("elevenlabs_voice_id");
    const have = new Set((existing ?? []).map((v: any) => v.elevenlabs_voice_id));
    const rows = voices
      .filter((v) => !have.has(v.voice_id))
      .map((v, i) => ({
        name: v.name,
        elevenlabs_voice_id: v.voice_id,
        gender: v.gender === "male" ? "male" : "female",
        accent: v.accent,
        description: v.description,
        preview_url: v.preview_url,
        is_active: false,
        sort_order: 100 + i,
      }));
    if (rows.length) {
      const { error } = await context.supabase.from("ai_call_voices").insert(rows as never);
      if (error) throw new Error(error.message);
    }
    return { imported: rows.length };
  });

/* --------------------------------- tones --------------------------------- */

export const listTones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await context.supabase.from("ai_call_tones").select("*").order("sort_order");
    return data ?? [];
  });

export const saveTone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().nullable().default(null),
        name: z.string().trim().min(1).max(60),
        description: z.string().trim().max(200).default(""),
        instructions: z.string().trim().max(2000).default(""),
        is_active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { id, ...row } = data;
    if (id) {
      const { error } = await context.supabase.from("ai_call_tones").update(row as never).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("ai_call_tones").insert(row as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("ai_call_tones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------------- agents -------------------------------- */

export const listAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("ai_call_agents")
      .select("*, stores(name), ai_call_voices(name), ai_call_tones(name)")
      .order("is_template", { ascending: false })
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const saveAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().nullable().default(null),
        name: z.string().trim().min(1).max(80),
        is_template: z.boolean().default(false),
        voice_id: z.string().uuid().nullable().default(null),
        tone_id: z.string().uuid().nullable().default(null),
        gender: z.enum(["female", "male"]).default("female"),
        language: z.string().trim().max(20).default("en"),
        personality: z.string().max(1000).default(""),
        instructions: z.string().max(8000).default(""),
        knowledge: z.string().max(8000).default(""),
        tools: z.record(z.string(), z.boolean()).default({}),
        inbound_enabled: z.boolean().default(true),
        outbound_enabled: z.boolean().default(true),
        status: z.enum(["active", "disabled"]).default("active"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { id, ...row } = data;
    if (id) {
      const { error } = await context.supabase.from("ai_call_agents").update(row as never).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true, id };
    }
    const { newToolSecret } = await import("@/lib/ai-call-center.server");
    const { data: created, error } = await context.supabase
      .from("ai_call_agents")
      .insert({ ...row, tool_secret: newToolSecret() } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (created as any).id };
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("ai_call_agents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- phone numbers ----------------------------- */

export const listPhoneNumbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("ai_phone_numbers")
      .select("*, stores(name), ai_call_agents(name)")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const savePhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().nullable().default(null),
        phone_number: z.string().trim().min(5).max(25),
        country: z.string().trim().max(4).default("US"),
        label: z.string().trim().max(60).default(""),
        provider_sid: z.string().trim().max(80).default(""),
        store_id: z.string().uuid().nullable().default(null),
        agent_id: z.string().uuid().nullable().default(null),
        inbound_enabled: z.boolean().default(true),
        outbound_enabled: z.boolean().default(true),
        available_to_store: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { id, ...row } = data;
    if (id) {
      const { error } = await context.supabase.from("ai_phone_numbers").update(row as never).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true, id };
    }
    const { data: created, error } = await context.supabase
      .from("ai_phone_numbers")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (created as any).id };
  });

/** Activate a number: import it into ElevenLabs and bind it to its agent. */
export const setPhoneNumberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = context.supabase;
    const { data: num } = await sb.from("ai_phone_numbers").select("*").eq("id", data.id).maybeSingle();
    if (!num) throw new Error("Phone number not found");

    if (!data.enabled) {
      await sb.from("ai_phone_numbers").update({ status: "inactive" } as never).eq("id", data.id);
      return { ok: true };
    }
    const n: any = num;
    if (!n.store_id || !n.agent_id) {
      throw new Error("Assign both a store and an AI agent before enabling this number.");
    }
    const { data: cfg } = await sb
      .from("ai_call_config")
      .select("elevenlabs_credentials,twilio_credentials")
      .eq("id", "global")
      .maybeSingle();
    const { readCreds, elImportNumber, elAssignNumber } = await import("@/lib/ai-call-center.server");
    const el = readCreds<any>((cfg as any)?.elevenlabs_credentials);
    const tw = readCreds<any>((cfg as any)?.twilio_credentials);
    if (!el || !tw) throw new Error("Connect ElevenLabs and Twilio first.");

    const { data: agent } = await sb
      .from("ai_call_agents")
      .select("elevenlabs_agent_id")
      .eq("id", n.agent_id)
      .maybeSingle();
    const agentId = (agent as any)?.elevenlabs_agent_id;
    if (!agentId) throw new Error("This agent has not been published to ElevenLabs yet.");

    let phoneId = n.elevenlabs_phone_id as string | null;
    if (!phoneId) {
      phoneId = await elImportNumber(el, tw, {
        phoneNumber: n.phone_number,
        label: n.label || n.phone_number,
      });
    }
    await elAssignNumber(el, phoneId, agentId);
    await sb
      .from("ai_phone_numbers")
      .update({ elevenlabs_phone_id: phoneId, status: "active" } as never)
      .eq("id", data.id);
    return { ok: true };
  });

export const releasePhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = context.supabase;
    const { data: num } = await sb
      .from("ai_phone_numbers")
      .select("elevenlabs_phone_id")
      .eq("id", data.id)
      .maybeSingle();
    const phoneId = (num as any)?.elevenlabs_phone_id;
    if (phoneId) {
      const { data: cfg } = await sb
        .from("ai_call_config")
        .select("elevenlabs_credentials")
        .eq("id", "global")
        .maybeSingle();
      const { readCreds, elReleaseNumber } = await import("@/lib/ai-call-center.server");
      const el = readCreds<any>((cfg as any)?.elevenlabs_credentials);
      if (el) await elReleaseNumber(el, phoneId);
    }
    const { error } = await sb.from("ai_phone_numbers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importTwilioNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = context.supabase;
    const { data: cfg } = await sb
      .from("ai_call_config")
      .select("twilio_credentials")
      .eq("id", "global")
      .maybeSingle();
    const { readCreds, twilioListNumbers } = await import("@/lib/ai-call-center.server");
    const tw = readCreds<any>((cfg as any)?.twilio_credentials);
    if (!tw) throw new Error("Save the Twilio credentials first.");
    const numbers = await twilioListNumbers(tw);
    const { data: existing } = await sb.from("ai_phone_numbers").select("phone_number");
    const have = new Set((existing ?? []).map((n: any) => n.phone_number));
    const rows = numbers
      .filter((n) => !have.has(n.phone_number))
      .map((n) => ({
        phone_number: n.phone_number,
        country: n.country,
        label: n.friendly_name,
        provider_sid: n.sid,
      }));
    if (rows.length) {
      const { error } = await sb.from("ai_phone_numbers").insert(rows as never);
      if (error) throw new Error(error.message);
    }
    return { imported: rows.length };
  });

/* ------------------------------- overview -------------------------------- */

export const aiCallOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = context.supabase;
    const [calls, stores, agents, numbers] = await Promise.all([
      sb.from("ai_calls").select("direction,status,result,duration_sec,cost"),
      sb.from("store_ai_call_settings").select("store_id").eq("is_active", true),
      sb.from("ai_call_agents").select("id").eq("status", "active"),
      sb.from("ai_phone_numbers").select("id").eq("status", "active"),
    ]);
    const rows = (calls.data ?? []) as any[];
    const count = (fn: (r: any) => boolean) => rows.filter(fn).length;
    const seconds = rows.reduce((a, r) => a + Number(r.duration_sec ?? 0), 0);
    return {
      total: rows.length,
      inbound: count((r) => r.direction === "inbound"),
      outbound: count((r) => r.direction === "outbound"),
      successful: count((r) => r.status === "completed"),
      confirmed: count((r) => r.result === "confirmed"),
      cancelled: count((r) => r.result === "cancelled"),
      no_answer: count((r) => r.result === "no_answer" || r.status === "no_answer"),
      failed: count((r) => r.status === "failed"),
      minutes: Math.round(seconds / 60),
      active_stores: stores.data?.length ?? 0,
      active_agents: agents.data?.length ?? 0,
      active_numbers: numbers.data?.length ?? 0,
      cost: rows.reduce((a, r) => a + Number(r.cost ?? 0), 0),
    };
  });

/* --------------------------- store management ---------------------------- */

export const listStoreAiCallCenters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = context.supabase;
    const [{ data: stores }, { data: settings }, { data: numbers }, { data: calls }] = await Promise.all([
      sb.from("stores").select("id,name,slug").order("name"),
      sb.from("store_ai_call_settings").select("*"),
      sb.from("ai_phone_numbers").select("id,phone_number,store_id"),
      sb.from("ai_calls").select("store_id,duration_sec"),
    ]);
    const byStore = new Map((settings ?? []).map((s: any) => [s.store_id, s]));
    const numById = new Map((numbers ?? []).map((n: any) => [n.id, n.phone_number]));
    return (stores ?? []).map((s: any) => {
      const st: any = byStore.get(s.id);
      const mine = (calls ?? []).filter((c: any) => c.store_id === s.id);
      return {
        store_id: s.id,
        name: s.name,
        slug: s.slug,
        feature_enabled: !!st?.feature_enabled,
        is_active: !!st?.is_active,
        phone_number: st?.phone_number_id ? (numById.get(st.phone_number_id) ?? null) : null,
        agent_id: st?.agent_id ?? null,
        calls: mine.length,
        minutes: Math.round(mine.reduce((a: number, c: any) => a + Number(c.duration_sec ?? 0), 0) / 60),
      };
    });
  });

export const setStoreAiCallFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: uuid, enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const patch: any = { store_id: data.storeId, feature_enabled: data.enabled };
    if (!data.enabled) patch.is_active = false;
    const { error } = await context.supabase
      .from("store_ai_call_settings")
      .upsert(patch as never, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllAiCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ storeId: z.string().uuid().nullable().default(null), limit: z.number().int().max(200).default(50) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    let q = context.supabase
      .from("ai_calls")
      .select("*, stores(name)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.storeId) q = q.eq("store_id", data.storeId);
    const { data: rows } = await q;
    return rows ?? [];
  });

/** Publish an agent (create/update it on ElevenLabs) using the current config. */
export const publishAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { publishAgentById } = await import("@/lib/ai-call-provision.server");
    return publishAgentById(context.supabase, data.id);
  });
