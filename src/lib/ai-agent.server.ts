// AI Commerce Engine — core agent logic used by storefront chat and Messenger webhook.
import { createClient } from "@supabase/supabase-js";
import { generateText, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  sendProductCard as fbSendProductCard,
  sendProductCarousel as fbSendProductCarousel,
  sendViewSiteButton as fbSendViewSiteButton,
  sendQuickReplies as fbSendQuickReplies,
} from "./messenger-send.server";
import { checkDuplicate } from "./duplicate-guard.server";
import { collectVerifiedFacts } from "./reply-guard.server";
import {
  fetchDeliveryZones,
  money,
  orderStatusBn,
  resolveDeliveryCharge,
  shortOrderNo,
} from "./chat-order-format";
import {
  ORDER_FIELD_LABELS,
  messengerPaymentMethods,
  normalizeOrderFlow,
  optionalSlotFields,
  renderConfirmation,
  requiredSlotFields,
  type OrderFieldKey,
} from "./messenger-order-flow";
import { replyStyleInstruction, SHORT_REPLY_RULE } from "./reply-language";
import { deriveCustomerStyle, personaInstruction } from "./agents/customer-style";
import { specialistFocus, allowedToolsFor, stepBudget } from "./agents/specialists";
import { asksForHuman } from "./conversation-guard.server";

import type { AgentContext, GlobalAiSettings, AgentState, FocusProduct } from "./ai-agent-types";
import { formatFocusVariants, BANGLA_SEARCH_SYNONYMS, DEICTIC_TOKENS, PRODUCT_SELECT_MIN, PRODUCT_STOPWORDS, PUBLIC_MESSENGER_ORIGIN, ProductKind, absoluteUrl, blockDuplicateMessengerToolOrder, canonicalCaption, clearConversationSlot, compactSummary, firstImage, getConversationSlot, isBroadBrowseQuery, isMessengerOrderable, isShortFollowUp, loadMessengerPaymentMethods, loadOrderFlow, normalizeCatalogProduct, normalizePhone, productKind, productSummary, productUrl, publicOrigin, resolveFocusProduct, scoreProductAgainstQuery, searchTerms, stringifyProductField, subscriptionBilling, updateConversationSlot, admin } from "./ai-agent-catalog.server";
import { drawerBoundRules, buildSystemPrompt } from "./ai-agent-prompt.server";
import { buildTools } from "./ai-agent-tools.server";
export type { AgentContext, GlobalAiSettings, AgentState, FocusProduct } from "./ai-agent-types";
export type { ProductKind } from "./ai-agent-catalog.server";
export { productKind, isMessengerOrderable, loadOrderFlow, loadMessengerPaymentMethods, isShortFollowUp, scoreProductAgainstQuery, canonicalCaption, resolveFocusProduct } from "./ai-agent-catalog.server";
export { drawerBoundRules, buildSystemPrompt } from "./ai-agent-prompt.server";
export { formatFocusVariants } from "./ai-agent-catalog.server";
export { buildTools } from "./ai-agent-tools.server";

export async function loadAiContext(storeId: string) {
  const sb = admin();
  const { cached } = await import("./ttl-cache.server");
  // Shared store/agent/global settings: short TTL cache (60s / 30s), per store.
  const [{ data: store }, { data: agent }, { data: settings }] = await Promise.all([
    cached(`ctx:store:${storeId}`, 60_000, async () =>
      await sb
        .from("stores")
        .select("id,slug,name,description,address,phone,whatsapp,facebook,delivery,payments_config")
        .eq("id", storeId)
        .maybeSingle(),
    ),
    cached(`ctx:agent:${storeId}`, 60_000, async () =>
      await sb.from("store_ai_agents").select("*").eq("store_id", storeId).maybeSingle(),
    ),
    cached(`ai_settings`, 30_000, async () =>
      await sb.from("ai_global_settings").select("*").eq("id", 1).maybeSingle(),
    ),
  ]);
  if (!store) throw new Error("Store not found");
  // A store may not have an agent row yet (older stores, or a failed seed).
  // Fall back to a sane enabled default instead of breaking the chat.
  const effectiveAgent =
    agent ??
    ({
      store_id: storeId,
      enabled: true,
      agent_name: "Sales Assistant",
      description: "",
      welcome_message: "Hi! How can I help you today?",
      fallback_message: "দুঃখিত, এই তথ্যটি আমার কাছে নেই। আমি স্টোর অ্যাডমিনকে জানিয়ে দিচ্ছি।",
      language: "both",
      style: "friendly",
      use_emoji: true,
      human_like: true,
      product_recommendations: true,
      order_assistance: true,
      sales_focused: true,
      recommend_related: true,
      ask_for_info: true,
      escalate_to_human: true,
      knowledge: {},
      order_flow: {},
      sources: {
        products: true,
        stock: true,
        categories: true,
        delivery: true,
        payments: true,
        returns: true,
        warranty: true,
        store_info: true,
        business_hours: true,
      },
    } as any);
  if (!agent) {
    // Best-effort self-heal so the owner panel shows the same settings.
    void sb.from("store_ai_agents").insert({ store_id: storeId, enabled: true } as any);
  }
  if (!effectiveAgent.enabled) throw new Error("Agent disabled");
  if (settings && settings.enabled === false) throw new Error("AI globally disabled");
  return { store, agent: effectiveAgent, settings };
}



export async function logUsage(storeId: string | null, model: string, usage: any, kind: string) {
  try {
    const sb = admin();
    const pt = usage?.promptTokens ?? usage?.inputTokens ?? 0;
    const ct = usage?.completionTokens ?? usage?.outputTokens ?? 0;
    const { estimateCostUsd } = await import("./ai-pricing");
    await sb.from("ai_usage").insert({
      store_id: storeId,
      model,
      prompt_tokens: pt,
      completion_tokens: ct,
      cost_usd: estimateCostUsd(model, pt, ct),
      kind,
    });
    // AI credit tracking (Messenger/WhatsApp/Web chat). Never blocks a reply.
    // Bill the real total: input + output tokens.
    const { billableTokens } = await import("./ai-credit-billing");
    const billed = billableTokens(pt, ct);
    if (storeId && billed > 0) {
      await (sb as any).rpc("consume_ai_credits", { _store: storeId, _tokens: billed, _channel: kind });
    }
  } catch {
    /* swallow */
  }
}

export async function getModelForStore(opts?: { fast?: boolean; modelOverride?: string }) {
  // Routes through the owner's saved Gemini/OpenAI keys (with serial rotation
  // and failure fallback) and finally the platform Lovable AI key.
  const { resolveAiModel } = await import("./ai-provider.server");
  const resolved = await resolveAiModel(opts);
  return {
    model: resolved.model,
    modelId: resolved.modelId,
    settings: (resolved.settings ?? null) as GlobalAiSettings | null,
    usedProvider: resolved.usedProvider,
  };
}

function generationParams(settings: GlobalAiSettings | null | undefined, modelId?: string) {
  const params: { temperature?: number; maxOutputTokens?: number } = {};
  const t = settings?.temperature;
  // Sales replies must stay factual: cap creativity at 1.0 (values >1 caused slow, rambling output).
  if (typeof t === "number" && Number.isFinite(t)) params.temperature = Math.max(0, Math.min(1, t));
  const m = settings?.max_tokens;
  // Skip maxOutputTokens for OpenAI models — newer models (o1/gpt-5 family) reject
  // `max_tokens` and require `max_completion_tokens`, which the AI SDK doesn't emit here.
  const isOpenAI = typeof modelId === "string" && modelId.startsWith("openai/");
  // Chat replies are short; a default cap stops runaway answers from burning credit.
  const cap = typeof m === "number" && Number.isFinite(m) && m > 0 ? Math.floor(m) : 350;
  if (!isOpenAI) params.maxOutputTokens = cap;
  return params;
}

export function streamAgentResponse(opts: { ctx: AgentContext; messages: any[]; system: string }) {
  return async () => {
    const { model, modelId, settings } = await getModelForStore();
    const streamTools = await toolsForTurn(opts.ctx, opts.messages);
    const result = streamText({
      model,
      system: opts.system,
      messages: opts.messages,
      tools: streamTools,
      stopWhen: stepCountIs(stepBudget(Object.keys(streamTools), { orderInProgress: await orderInProgressFor(opts.ctx) })),
      ...generationParams(settings, modelId),
      onFinish: ({ usage }) => {
        void logUsage(opts.ctx.storeId, modelId, usage, "chat");
      },
    });
    return result;
  };
}

function findDuplicateBlockedReply(
  value: any,
  depth = 0,
  seen = new WeakSet<object>(),
): string | null {
  if (!value || depth > 8) return null;
  if (typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);
  if (
    value.error === "duplicate_blocked" &&
    typeof value.reply === "string" &&
    value.reply.trim()
  ) {
    return value.reply;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDuplicateBlockedReply(item, depth + 1, seen);
      if (found) return found;
    }
    return null;
  }
  for (const item of Object.values(value)) {
    const found = findDuplicateBlockedReply(item, depth + 1, seen);
    if (found) return found;
  }
  return null;
}

function isTransientGatewayError(err: unknown) {
  const msg = (err as any)?.message || "";
  const status = (err as any)?.statusCode ?? (err as any)?.status;
  if (status === 429 || (typeof status === "number" && status >= 500 && status < 600)) return true;
  return /\b(429|rate.?limit|timeout|overload|5\d\d)\b/i.test(String(msg));
}

async function orderInProgressFor(ctx: AgentContext): Promise<boolean> {
  if (!ctx.conversationId) return false;
  const slot = await getConversationSlot(ctx.conversationId).catch(() => ({}));
  return Object.keys(slot ?? {}).length > 0;
}

/** Phase 2 tool diet: drop rarely-needed tools unless the latest message asks for them. */
async function toolsForTurn(ctx: AgentContext, messages: any[]) {
  const last = [...messages].reverse().find((m) => m?.role === "user");
  const text =
    typeof last?.content === "string"
      ? last.content
      : Array.isArray(last?.content)
        ? last.content.map((p: any) => (p?.type === "text" ? p.text : "")).join(" ")
        : "";
  return scopedToolsForText(ctx, text);
}

/** The ONLY way any channel (Messenger, WhatsApp, web chat) gets tools: routed agent(s) only. */
export async function scopedToolsForText(ctx: AgentContext, text: string) {
  const all = buildTools(ctx) as Record<string, any>;
  const drop: string[] = [];
  if (!/compare|তুলনা|vs|পার্থক্য|difference|কোনটা ভালো/i.test(text)) drop.push("compareProducts");
  if (!/brand|ব্র্যান্ড|ব্রান্ড/i.test(text)) drop.push("listBrands");
  if (
    !/track|ট্র্যাক|ট্রাক|কোথায়|কই|কবে|কখন|পাব|আসবে|পাঠা|ডেলিভারি|deliver|parcel|পার্সেল|status|স্ট্যাটাস|order|অর্ডার|অডার|invoice|ইনভয়েস|[\d০-৯][\d০-৯\s\-]{4,}/i.test(text)
  )
    drop.push("trackOrder");
  for (const k of drop) delete all[k];
  // Channel drawer: only the card tools this channel can render.
  const ch = ctx.channel ?? "messenger";
  const notForChannel = ch === "web" ? ["sendProductCard", "sendProductCarousel"] : ch === "whatsapp" ? ["showProduct", "showProducts", "sendProductCarousel"] : ["showProduct", "showProducts"];
  for (const k of notForChannel) delete all[k];
  // Phase 2 tool scoping: only the routed agent(s)' tools are sent.
  try {
    let orderInProgress = false;
    if (ctx.conversationId) {
      const slot = await getConversationSlot(ctx.conversationId).catch(() => ({}));
      orderInProgress = Object.keys(slot ?? {}).length > 0;
    }
    const allowed = allowedToolsFor(text, { orderInProgress, hasFocus: !!ctx.focusProductId });
    if (allowed) for (const k of Object.keys(all)) if (!allowed.has(k)) delete all[k];
    // Handoff silences the AI for this customer, so it is only offered when the
    // customer explicitly asks for a person — never for missing colours/specs.
    if (!asksForHuman(text)) delete all.escalateToHuman;
  } catch { /* scoping is an optimisation; never block a reply */ }
  return all;
}

async function runGenerate(opts: {
  ctx: AgentContext;
  messages: any[];
  system: string;
  fast?: boolean;
  modelOverride?: string;
}) {
  const { model, modelId, settings } = await getModelForStore({
    fast: opts.fast,
    modelOverride: opts.modelOverride,
  });
  const tools = await toolsForTurn(opts.ctx, opts.messages);
  try {
    const { setTraceMeta } = await import("./telemetry.server");
    setTraceMeta("prompt_chars", opts.system.length);
    setTraceMeta("tool_count", Object.keys(tools).length);
  } catch {}
  const result = await generateText({
    model,
    system: opts.system,
    messages: opts.messages,
    tools,
    // Each step re-sends the whole prompt + tool schemas. No tools → 1 step;
    // focus product → card + text = 2; otherwise search → card → text = 3.
    stopWhen: stepCountIs(stepBudget(Object.keys(tools), { orderInProgress: await orderInProgressFor(opts.ctx) })),
    ...generationParams(settings, modelId),
  });
  try {
    const { setTraceMeta } = await import("./telemetry.server");
    const u: any = (result as any).totalUsage ?? result.usage;
    setTraceMeta("input_tokens", u?.inputTokens ?? null);
    setTraceMeta("output_tokens", u?.outputTokens ?? null);
  } catch {}
  return { result, modelId, settings };
}

/** Variants may be an array or {options, items}; empty → "". */

export type MessengerPayloadFacts = {
  hasCard?: boolean;
  hasImage?: boolean;
  hasLink?: boolean;
  hasButton?: boolean;
};

/** What the agent actually sent this turn, so pointer phrases can be verified. */
function payloadFactsFromResult(result: any): MessengerPayloadFacts {
  const names: string[] = [];
  for (const step of (result?.steps ?? []) as any[]) {
    for (const call of (step?.toolCalls ?? []) as any[]) {
      if (call?.toolName) names.push(String(call.toolName));
    }
  }
  const has = (n: string) => names.includes(n);
  const card = has("sendProductCard") || has("sendProductCarousel");
  return {
    hasCard: card,
    hasImage: card,
    hasLink: has("sendProductLink"),
    hasButton: has("sendProductLink") || card,
  };
}

export async function generateAgentReply(opts: {
  ctx: AgentContext;
  messages: any[];
  system: string;
  fast?: boolean;
}) {
  // No-data chit-chat agent: social messages need no store facts → 0 tokens.
  try {
    const last = [...opts.messages].reverse().find((m) => m?.role === "user");
    const lt = typeof last?.content === "string" ? last.content : "";
    const { noDataChatReply } = await import("./fast-path-replies");
    const chat = noDataChatReply(lt);
    if (chat && !opts.ctx.focusProductId) {
      const slot = opts.ctx.conversationId ? await getConversationSlot(opts.ctx.conversationId).catch(() => ({})) : {};
      if (!Object.keys(slot ?? {}).length) {
        return { text: chat, facts: {} as MessengerPayloadFacts, verified: collectVerifiedFacts({ steps: [] } as any), raw: true };
      }
    }
  } catch { /* fall through to AI */ }
  // Store-isolated safe answer cache (informational replies only; 0 tokens).
  let safeKey: string | null = null;
  try {
    const sac = await import("./safe-answer-cache");
    const last = [...opts.messages].reverse().find((m) => m?.role === "user");
    const lt = typeof last?.content === "string" ? last.content : "";
    // Only standalone opening questions: any earlier turn means the reply may depend on context.
    const priorTurns = opts.messages.filter((m) => m?.role === "user" || m?.role === "assistant").length - 1;
    const standalone = priorTurns <= 0 && lt.trim().split(/\s+/).length >= 3;
    if (standalone && !opts.ctx.focusProductId && opts.ctx.conversationId) {
      const slot = await getConversationSlot(opts.ctx.conversationId).catch(() => ({ x: 1 }));
      if (!Object.keys(slot ?? {}).length) safeKey = sac.cacheKey(opts.ctx.storeId, opts.ctx.channel ?? "messenger", lt);
    }
    const hit = sac.getSafeAnswer(safeKey);
    if (hit) {
      try { const { setTraceMeta } = await import("./telemetry.server"); setTraceMeta("cache_hit", true); } catch {}
      return { text: hit, facts: {} as MessengerPayloadFacts, verified: collectVerifiedFacts({ steps: [] } as any), raw: true };
    }
  } catch { safeKey = null; }
  let attempt: Awaited<ReturnType<typeof runGenerate>>;
  try {
    attempt = await runGenerate(opts);
  } catch (err) {
    // Transient (429/5xx/timeout): switch once — merchant's fallback model if set,
    // otherwise one short-delayed re-route (provider rotation skips the busy model).
    if (!isTransientGatewayError(err)) throw err;
    const { settings } = await getModelForStore({ fast: opts.fast });
    const fb = (settings?.fallback_model || "").trim();
    try { const { setTraceMeta } = await import("./telemetry.server"); setTraceMeta("failover", fb || "reroute"); } catch {}
    if (fb) {
      attempt = await runGenerate({ ...opts, modelOverride: fb });
    } else {
      await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 400)));
      attempt = await runGenerate({ ...opts, fast: !opts.fast });
    }
  }
  const { result, modelId } = attempt;
  // totalUsage sums every tool step; usage is only the last step.
  void logUsage(opts.ctx.storeId, modelId, (result as any).totalUsage ?? result.usage, opts.ctx.channel ?? "messenger");
  try {
    const { setTraceMeta } = await import("./telemetry.server");
    const u: any = (result as any).usage ?? {};
    setTraceMeta("model", modelId);
    setTraceMeta("ai_steps", Array.isArray((result as any).steps) ? (result as any).steps.length : null);
    setTraceMeta("tokens", Number(u.totalTokens ?? (Number(u.inputTokens ?? 0) + Number(u.outputTokens ?? 0))) || null);
  } catch { /* telemetry never blocks */ }
  const verified = collectVerifiedFacts(result);
  const duplicateReply = findDuplicateBlockedReply(result as any);
  if (duplicateReply) return { text: duplicateReply, facts: {} as MessengerPayloadFacts, verified, raw: true };
  try {
    const usedTools = ((result as any).steps ?? []).some((s: any) => (s?.toolCalls ?? []).length > 0);
    const { putSafeAnswer } = await import("./safe-answer-cache");
    putSafeAnswer(safeKey, String(result.text ?? ""), usedTools);
  } catch {}
  const toolCalls = ((result as any).steps ?? []).flatMap((s: any) =>
    (s?.toolCalls ?? []).map((c: any) => ({ name: String(c?.toolName ?? ""), args: c?.input ?? c?.args ?? null })),
  ) as { name: string; args: any }[];
  return { text: result.text as string, facts: payloadFactsFromResult(result), verified, raw: false, toolCalls };
}
