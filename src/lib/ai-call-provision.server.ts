// Server-only provisioning for AI call agents, store activation and outbound
// calls. Never import from client-reachable module scope.
import {
  readCreds,
  elCreateAgent,
  elUpdateAgent,
  elAssignNumber,
  elImportNumber,
  elOutboundCall,
  buildStoreContext,
  buildStorePrompt,
  buildOrderVariables,
  newToolSecret,
  BASE_TEMPLATE_PROMPT,
  withinCallingHours,
  type AgentSpec,
} from "@/lib/ai-call-center.server";

export function siteUrl(): string {
  return process.env.PUBLIC_SITE_URL || "https://orzen.top";
}

export async function loadConfig(sb: any) {
  const { data } = await sb.from("ai_call_config").select("*").eq("id", "global").maybeSingle();
  if (!data) throw new Error("AI Call Center is not configured yet.");
  return data as any;
}

export function elCreds(cfg: any) {
  const creds = readCreds<any>(cfg.elevenlabs_credentials);
  if (!creds?.api_key) throw new Error("ElevenLabs is not connected.");
  return creds;
}

/** Build the full agent spec for one agent row (template or store agent). */
async function specFor(sb: any, cfg: any, agent: any): Promise<AgentSpec> {
  const [{ data: voice }, { data: tone }] = await Promise.all([
    agent.voice_id
      ? sb.from("ai_call_voices").select("elevenlabs_voice_id").eq("id", agent.voice_id).maybeSingle()
      : Promise.resolve({ data: null }),
    agent.tone_id
      ? sb.from("ai_call_tones").select("instructions").eq("id", agent.tone_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const storeContext = agent.store_id ? await buildStoreContext(sb, agent.store_id) : "";
  const base = [agent.instructions || cfg.default_instructions || BASE_TEMPLATE_PROMPT, agent.knowledge]
    .filter(Boolean)
    .join("\n\n");

  const prompt = buildStorePrompt({
    base,
    toneInstructions: (tone as any)?.instructions ?? null,
    personality: agent.personality,
    behavior: cfg.behavior ?? {},
    business: cfg.business ?? {},
    storeContext,
  });

  return {
    name: agent.name,
    prompt,
    firstMessage: agent.store_id
      ? "Hello, this is {{store_name}} calling about your order {{order_id}}. Is this {{customer_name}}?"
      : "Hello, how can I help you today?",
    voiceId: (voice as any)?.elevenlabs_voice_id ?? null,
    language: agent.language || cfg.default_language || "en",
    maxDurationSec: Number(cfg.rules?.max_duration_sec ?? 300),
    silenceTimeoutSec: Number(cfg.behavior?.silence_timeout_sec ?? 8),
  };
}

/** Create or update the ElevenLabs agent behind one agent row. */
export async function publishAgentById(sb: any, agentId: string) {
  const cfg = await loadConfig(sb);
  const creds = elCreds(cfg);
  const { data: agent } = await sb.from("ai_call_agents").select("*").eq("id", agentId).maybeSingle();
  if (!agent) throw new Error("Agent not found");

  const spec = await specFor(sb, cfg, agent);
  try {
    let elId = (agent as any).elevenlabs_agent_id as string | null;
    if (elId) await elUpdateAgent(creds, elId, spec);
    else elId = await elCreateAgent(creds, spec);
    await sb
      .from("ai_call_agents")
      .update({ elevenlabs_agent_id: elId, status: "active", last_error: null } as never)
      .eq("id", agentId);
    return { ok: true as const, agentId: elId };
  } catch (e: any) {
    await sb
      .from("ai_call_agents")
      .update({ last_error: String(e?.message ?? e).slice(0, 500) } as never)
      .eq("id", agentId);
    throw e;
  }
}

/**
 * Clone the master template into a store-specific agent (or refresh it) and
 * bind the store's number to it. Used when a store activates the feature.
 */
export async function provisionStoreAgent(
  sb: any,
  opts: { storeId: string; voiceId: string | null; toneId: string | null; gender: string; phoneNumberId: string },
) {
  const cfg = await loadConfig(sb);
  const creds = elCreds(cfg);
  const twilio = readCreds<any>(cfg.twilio_credentials);
  if (!twilio) throw new Error("Twilio is not connected.");

  const { data: template } = await sb
    .from("ai_call_agents")
    .select("*")
    .eq("is_template", true)
    .maybeSingle();
  if (!template) throw new Error("The platform owner has not created the master AI agent yet.");

  const { data: store } = await sb.from("stores").select("name").eq("id", opts.storeId).maybeSingle();
  const { data: existing } = await sb
    .from("ai_call_agents")
    .select("*")
    .eq("store_id", opts.storeId)
    .maybeSingle();

  const row: any = {
    store_id: opts.storeId,
    is_template: false,
    name: `${(store as any)?.name ?? "Store"} AI Agent`,
    voice_id: opts.voiceId ?? (template as any).voice_id,
    tone_id: opts.toneId ?? (template as any).tone_id,
    gender: opts.gender,
    language: (template as any).language,
    personality: (template as any).personality,
    instructions: (template as any).instructions,
    knowledge: (template as any).knowledge,
    tools: (template as any).tools,
    inbound_enabled: (template as any).inbound_enabled,
    outbound_enabled: (template as any).outbound_enabled,
    status: "active",
  };

  let agentRowId: string;
  if (existing) {
    agentRowId = (existing as any).id;
    await sb.from("ai_call_agents").update(row as never).eq("id", agentRowId);
  } else {
    const { data: created, error } = await sb
      .from("ai_call_agents")
      .insert({ ...row, tool_secret: newToolSecret() } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    agentRowId = (created as any).id;
  }

  const published = await publishAgentById(sb, agentRowId);

  // Bind the phone number to the freshly published agent.
  const { data: num } = await sb
    .from("ai_phone_numbers")
    .select("*")
    .eq("id", opts.phoneNumberId)
    .maybeSingle();
  if (!num) throw new Error("Phone number not found");
  let phoneId = (num as any).elevenlabs_phone_id as string | null;
  if (!phoneId) {
    phoneId = await elImportNumber(creds, twilio, {
      phoneNumber: (num as any).phone_number,
      label: (num as any).label || (num as any).phone_number,
    });
  }
  await elAssignNumber(creds, phoneId, published.agentId!);
  await sb
    .from("ai_phone_numbers")
    .update({
      elevenlabs_phone_id: phoneId,
      status: "active",
      store_id: opts.storeId,
      agent_id: agentRowId,
    } as never)
    .eq("id", opts.phoneNumberId);

  return { agentRowId };
}

/* ------------------------------ outbound run ----------------------------- */

/** Place one queued outbound call. Returns whether the call was started. */
export async function runQueueItem(sb: any, item: any): Promise<{ started: boolean; reason?: string }> {
  const cfg = await loadConfig(sb);
  const rules = cfg.rules ?? {};
  if (!withinCallingHours(rules)) return { started: false, reason: "outside_hours" };

  const { data: settings } = await sb
    .from("store_ai_call_settings")
    .select("*")
    .eq("store_id", item.store_id)
    .maybeSingle();
  if (!settings || !(settings as any).is_active || !(settings as any).outbound_enabled) {
    await sb.from("ai_call_queue").update({ status: "skipped" } as never).eq("id", item.id);
    return { started: false, reason: "inactive" };
  }

  const s: any = settings;
  const [{ data: agent }, { data: num }] = await Promise.all([
    sb.from("ai_call_agents").select("id,elevenlabs_agent_id").eq("id", s.agent_id).maybeSingle(),
    sb.from("ai_phone_numbers").select("id,elevenlabs_phone_id").eq("id", s.phone_number_id).maybeSingle(),
  ]);
  if (!(agent as any)?.elevenlabs_agent_id || !(num as any)?.elevenlabs_phone_id) {
    await sb
      .from("ai_call_queue")
      .update({ status: "failed", last_error: "Agent or number not provisioned" } as never)
      .eq("id", item.id);
    return { started: false, reason: "not_provisioned" };
  }

  const creds = elCreds(cfg);
  const vars = await buildOrderVariables(sb, item.store_id, item.order_id);

  const { data: call } = await sb
    .from("ai_calls")
    .insert({
      store_id: item.store_id,
      order_id: item.order_id,
      agent_id: (agent as any).id,
      phone_number_id: (num as any).id,
      direction: "outbound",
      customer_name: item.customer_name,
      phone: item.phone,
      status: "calling",
      attempt: item.attempts + 1,
      started_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();

  try {
    const res = await elOutboundCall(creds, {
      agentId: (agent as any).elevenlabs_agent_id,
      agentPhoneNumberId: (num as any).elevenlabs_phone_id,
      toNumber: item.phone,
      dynamicVariables: vars,
    });
    await sb
      .from("ai_calls")
      .update({ conversation_id: res.conversationId, provider_call_sid: res.callSid } as never)
      .eq("id", (call as any).id);
    await sb
      .from("ai_call_queue")
      .update({ status: "called", attempts: item.attempts + 1 } as never)
      .eq("id", item.id);
    return { started: true };
  } catch (e: any) {
    const attempts = item.attempts + 1;
    const maxRetries = Number(rules.retry_count ?? 2);
    const retryIn = Number(rules.retry_interval_minutes ?? 30);
    await sb
      .from("ai_calls")
      .update({ status: "failed", result: "failed", ended_at: new Date().toISOString() } as never)
      .eq("id", (call as any).id);
    await sb
      .from("ai_call_queue")
      .update({
        attempts,
        status: attempts > maxRetries ? "failed" : "pending",
        run_after: new Date(Date.now() + retryIn * 60_000).toISOString(),
        last_error: String(e?.message ?? e).slice(0, 400),
      } as never)
      .eq("id", item.id);
    return { started: false, reason: "provider_error" };
  }
}

/** Drain due queue items. Used by the cron endpoint. */
export async function drainCallQueue(sb: any, limit = 10) {
  const { data: items } = await sb
    .from("ai_call_queue")
    .select("*")
    .eq("status", "pending")
    .lte("run_after", new Date().toISOString())
    .order("run_after")
    .limit(limit);

  let started = 0;
  for (const item of (items ?? []) as any[]) {
    try {
      const res = await runQueueItem(sb, item);
      if (res.started) started += 1;
    } catch {
      /* keep draining */
    }
  }
  return { processed: items?.length ?? 0, started };
}

/** Queue an order-confirmation call when the store has the feature running. */
export async function enqueueOrderConfirmationCall(sb: any, storeId: string, orderId: string) {
  const { data: settings } = await sb
    .from("store_ai_call_settings")
    .select("is_active,outbound_enabled,auto_confirm_orders")
    .eq("store_id", storeId)
    .maybeSingle();
  const s: any = settings;
  if (!s?.is_active || !s.outbound_enabled || !s.auto_confirm_orders) return { queued: false };

  const { data: cfg } = await sb.from("ai_call_config").select("rules").eq("id", "global").maybeSingle();
  const delay = Number((cfg as any)?.rules?.delay_minutes ?? 5);

  const { data: order } = await sb
    .from("orders")
    .select("phone,customer_name")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.phone) return { queued: false };

  await sb.from("ai_call_queue").insert({
    store_id: storeId,
    order_id: orderId,
    phone: (order as any).phone,
    customer_name: (order as any).customer_name,
    purpose: "order_confirmation",
    run_after: new Date(Date.now() + delay * 60_000).toISOString(),
  } as never);
  return { queued: true };
}
