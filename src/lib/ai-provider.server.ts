// Central AI provider resolver.
//
// The Winner Admin (owner) panel lets the platform owner store their own
// Gemini / OpenAI API keys. Before this module those keys were saved but never
// used — every call went to the built-in Lovable AI gateway. Here we build a
// single AI SDK model whose underlying fetch walks a candidate chain:
//
//   saved Gemini keys (serial rotation)  ->  saved OpenAI key  ->  Lovable AI
//
// If a candidate fails (bad key, quota, provider outage) we record the failure
// on that key and transparently retry the same request with the next candidate,
// so the chat never goes silent because of one broken key.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { dhakaToday, normalizeGeminiKeys, pickActiveGeminiKey, type GeminiKey } from "./gemini-keys.server";

const SENTINEL_BASE = "https://ai-router.internal/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const OPENAI_BASE = "https://api.openai.com/v1";
const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";

export type AiProviderKind = "gemini" | "openai" | "platform";

type Candidate = {
  provider: AiProviderKind;
  keyId: string | null;
  label: string;
  apiKey: string;
  baseURL: string;
  modelId: string;
  headers: Record<string, string>;
};

export type ResolvedAi = {
  model: any;
  /** Model id as configured (gateway style, e.g. "google/gemini-2.5-flash"). */
  modelId: string;
  settings: any | null;
  /** Which provider actually served the last request (set after the call). */
  usedProvider: () => { provider: AiProviderKind; label: string } | null;
};

function admin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function stripVendor(modelId: string) {
  return modelId.includes("/") ? modelId.slice(modelId.indexOf("/") + 1) : modelId;
}

function geminiModel(modelId: string) {
  const m = stripVendor(modelId);
  return m.startsWith("gemini") ? m : "gemini-2.5-flash";
}

function openaiModel(modelId: string) {
  if (modelId.startsWith("openai/")) return stripVendor(modelId);
  return "gpt-4o-mini";
}

function buildCandidates(settings: any, modelId: string): Candidate[] {
  const out: Candidate[] = [];
  const geminiKeys = normalizeGeminiKeys(settings?.gemini_api_keys);
  const active = pickActiveGeminiKey(geminiKeys);
  // Serial rotation: start at the active key, then the remaining usable keys.
  const ordered: GeminiKey[] = active
    ? [active, ...geminiKeys.filter((k) => k.id !== active.id && k.enabled)]
    : geminiKeys.filter((k) => k.enabled);
  for (const k of ordered) {
    out.push({
      provider: "gemini",
      keyId: k.id,
      label: k.label || "Gemini key",
      apiKey: k.key,
      baseURL: GEMINI_BASE,
      modelId: geminiModel(modelId),
      headers: {},
    });
  }
  const single = (settings?.gemini_api_key || "").trim();
  if (single && !ordered.some((k) => k.key === single)) {
    out.push({
      provider: "gemini",
      keyId: null,
      label: "Gemini key",
      apiKey: single,
      baseURL: GEMINI_BASE,
      modelId: geminiModel(modelId),
      headers: {},
    });
  }
  const openaiKey = (settings?.openai_api_key || "").trim();
  if (openaiKey) {
    out.push({
      provider: "openai",
      keyId: null,
      label: "OpenAI key",
      apiKey: openaiKey,
      baseURL: OPENAI_BASE,
      modelId: openaiModel(modelId),
      headers: {},
    });
  }
  // Platform (Lovable AI) — always the last resort, and the default when the
  // owner has not stored any key of their own.
  const saved = (settings?.provider_api_key || "").trim();
  const looksLovable = saved.startsWith("lv_") || saved.startsWith("sk-lovable");
  const platformKey = (looksLovable ? saved : "") || process.env.LOVABLE_API_KEY || "";
  if (platformKey) {
    out.push({
      provider: "platform",
      keyId: null,
      label: "Lovable AI",
      apiKey: platformKey,
      baseURL: LOVABLE_BASE,
      modelId,
      headers: { "Lovable-API-Key": platformKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
  }
  return out;
}

/** Pauses a Gemini key for the rest of the day and stores why it failed. */
async function markGeminiFailure(keyId: string, error: string) {
  try {
    const sb = admin();
    const { data } = await sb.from("ai_global_settings").select("gemini_api_keys").eq("id", 1).maybeSingle();
    const keys = normalizeGeminiKeys((data as any)?.gemini_api_keys);
    const next = keys.map((k) =>
      k.id === keyId ? { ...k, failed_on: dhakaToday(), last_error: error.slice(0, 300) } : k,
    );
    await sb.from("ai_global_settings").update({ gemini_api_keys: next as any } as any).eq("id", 1);
  } catch {
    /* never break a chat because bookkeeping failed */
  }
}

function retryable(status: number) {
  return status === 400 || status === 401 || status === 403 || status === 404 || status === 429 || status >= 500;
}

/**
 * Builds one AI SDK model that routes through the owner's keys with fallback.
 * `modelId` is the gateway-style id stored in settings (e.g. "google/gemini-2.5-flash").
 */
export function buildRoutedModel(settings: any, modelId: string): ResolvedAi {
  const candidates = buildCandidates(settings, modelId);
  if (!candidates.length) {
    throw new Error(
      "No AI provider is configured. Add a Gemini or OpenAI key in Winner Admin → AI, or configure the platform AI key.",
    );
  }
  let used: { provider: AiProviderKind; label: string } | null = null;

  const routedFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const suffix = url.pathname.replace(/^\/v1/, "") + url.search;
    let bodyObj: any = null;
    if (typeof init?.body === "string") {
      try {
        bodyObj = JSON.parse(init.body);
      } catch {
        bodyObj = null;
      }
    }

    let lastError = "AI request failed";
    for (const c of candidates) {
      const headers = new Headers(init?.headers);
      headers.delete("authorization");
      headers.delete("Lovable-API-Key");
      headers.set("content-type", "application/json");
      if (c.provider === "platform") {
        for (const [k, v] of Object.entries(c.headers)) headers.set(k, v);
      } else {
        headers.set("authorization", `Bearer ${c.apiKey}`);
      }
      const body = bodyObj ? JSON.stringify({ ...bodyObj, model: c.modelId }) : (init?.body as any);

      try {
        const res = await fetch(`${c.baseURL}${suffix}`, { ...init, headers, body });
        if (res.ok) {
          used = { provider: c.provider, label: c.label };
          return res;
        }
        const text = await res.text().catch(() => "");
        lastError = `${c.label}: HTTP ${res.status} ${text.slice(0, 300)}`;
        if (!retryable(res.status)) {
          used = { provider: c.provider, label: c.label };
          return new Response(text, { status: res.status, headers: res.headers });
        }
        if (c.provider === "gemini" && c.keyId) void markGeminiFailure(c.keyId, lastError);
      } catch (e) {
        lastError = `${c.label}: ${(e as Error).message}`;
        if (c.provider === "gemini" && c.keyId) void markGeminiFailure(c.keyId, lastError);
      }
    }
    throw new Error(lastError);
  };

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: SENTINEL_BASE,
    fetch: routedFetch as any,
  });

  return {
    model: provider(modelId),
    modelId,
    settings: settings ?? null,
    usedProvider: () => used,
  };
}

/** Loads global settings and returns a routed model. */
export async function resolveAiModel(opts?: { fast?: boolean; modelOverride?: string }): Promise<ResolvedAi> {
  const sb = admin();
  const { data: settings } = await sb.from("ai_global_settings").select("*").eq("id", 1).maybeSingle();
  const configured = opts?.modelOverride || (settings as any)?.default_model || "google/gemini-2.5-flash";
  const modelId = opts?.fast && configured.includes("pro") ? "google/gemini-2.5-flash" : configured;
  return buildRoutedModel(settings, modelId);
}

/** Which provider would serve the next request (for the owner panel). */
export async function describeActiveAiProvider() {
  const sb = admin();
  const { data: settings } = await sb.from("ai_global_settings").select("*").eq("id", 1).maybeSingle();
  const modelId = (settings as any)?.default_model || "google/gemini-2.5-flash";
  const list = buildCandidates(settings, modelId);
  const first = list[0] ?? null;
  return {
    model: modelId,
    active: first ? { provider: first.provider, label: first.label, model: first.modelId } : null,
    chain: list.map((c) => ({ provider: c.provider, label: c.label, model: c.modelId })),
  };
}
