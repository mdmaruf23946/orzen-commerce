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
import {
  dhakaToday,
  keyBaseURL,
  normalizeGeminiKeys,
  pickActiveGeminiKey,
  providerPreset,
  type GeminiKey,
  type KeyProvider,
} from "./gemini-keys.server";
import { requireServerEnv } from "./server-env";

const SENTINEL_BASE = "https://ai-router.internal/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const OPENAI_BASE = "https://api.openai.com/v1";

export type AiProviderKind = KeyProvider | "platform";

type Candidate = {
  provider: AiProviderKind;
  keyId: string | null;
  label: string;
  apiKey: string;
  baseURL: string;
  modelId: string;
  /** Sibling models tried on the same key when the first is busy or out of quota. */
  fallbacks: string[];
  /** Whether this key's model can read images. */
  vision: boolean;
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
  return createClient<Database>(
    requireServerEnv("SUPABASE_URL"),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

function stripVendor(modelId: string) {
  return modelId.includes("/") ? modelId.slice(modelId.indexOf("/") + 1) : modelId;
}

// Google's own API serves its own model names, and older ones get retired for
// new users. Use Google's "latest" aliases so a saved key never breaks because
// a specific version was withdrawn.
function geminiModel(modelId: string) {
  const m = stripVendor(modelId);
  if (m.includes("pro")) return "gemini-pro-latest";
  if (m.includes("lite")) return "gemini-flash-lite-latest";
  return "gemini-flash-latest";
}

/** Sibling Gemini models tried on the same key when the first is busy or out of quota. */
function geminiFallbackModels(primary: string): string[] {
  if (primary === "gemini-pro-latest") return ["gemini-flash-latest", "gemini-3.6-flash", "gemini-3.5-flash"];
  if (primary === "gemini-flash-lite-latest") return ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
  return ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash-preview"];
}

function openaiModel(modelId: string) {
  if (modelId.startsWith("openai/")) return stripVendor(modelId);
  return "gpt-4o-mini";
}

/** Turns one saved key into a routing candidate. */
function candidateFromKey(k: GeminiKey, modelId: string): Candidate | null {
  const preset = providerPreset(k.provider);
  const baseURL = keyBaseURL(k);
  if (!baseURL) return null;
  if (k.provider === "gemini") {
    const chosen = k.model || geminiModel(modelId);
    return {
      provider: "gemini",
      keyId: k.id,
      label: k.label || "Gemini key",
      apiKey: k.key,
      baseURL,
      modelId: chosen,
      fallbacks: k.model ? preset.fallbacks : geminiFallbackModels(chosen),
      vision: k.vision,
      headers: {},
    };
  }
  const chosen = k.model || preset.model;
  if (!chosen) return null;
  return {
    provider: k.provider,
    keyId: k.id,
    label: k.label || preset.name,
    apiKey: k.key,
    baseURL,
    modelId: chosen,
    fallbacks: k.model ? [] : preset.fallbacks,
    vision: k.vision,
    headers:
      k.provider === "openrouter"
        ? { "http-referer": "https://orzen.top", "x-title": "Orzen Commerce" }
        : {},
  };
}

function buildCandidates(settings: any, modelId: string): Candidate[] {
  const out: Candidate[] = [];
  const allKeys = normalizeGeminiKeys(settings?.gemini_api_keys);
  const active = pickActiveGeminiKey(allKeys);
  const today = dhakaToday();
  // Serial rotation: start at the active key, then the remaining usable keys,
  // and finally keys that failed earlier today as a last resort.
  const ordered: GeminiKey[] = active
    ? [active, ...allKeys.filter((k) => k.id !== active.id && k.enabled)]
    : allKeys.filter((k) => k.enabled);
  const usable = ordered.filter((k) => k.id === active?.id || k.failed_on !== today);
  const parked = ordered.filter((k) => !usable.includes(k));
  for (const k of [...usable, ...parked]) {
    const c = candidateFromKey(k, modelId);
    if (c) out.push(c);
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
      fallbacks: geminiFallbackModels(geminiModel(modelId)),
      vision: true,
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
      fallbacks: [],
      vision: true,
      headers: {},
    });
  }
  // The platform (Lovable AI) gateway is intentionally NOT part of the chain:
  // every AI request on this site must run on the owner's own provider keys.
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

// Per-attempt time limit + per-isolate circuit breaker (key|model).
const ATTEMPT_TIMEOUT_MS = 12_000;
const BREAKER_FAILS = 3;
const BREAKER_OPEN_MS = 120_000;
const breaker = new Map<string, { fails: number; openUntil: number }>();
function breakerOpen(k: string) {
  const b = breaker.get(k);
  return !!b && b.openUntil > Date.now();
}
function breakerFail(k: string, why: string) {
  const b = breaker.get(k) ?? { fails: 0, openUntil: 0 };
  b.fails += 1;
  if (b.fails >= BREAKER_FAILS) {
    b.openUntil = Date.now() + BREAKER_OPEN_MS;
    b.fails = BREAKER_FAILS - 1; // half-open: one more failure re-opens
    console.warn("[ai-route] breaker open 120s:", k, why.slice(0, 120));
  }
  breaker.set(k, b);
}
function breakerSuccess(k: string) {
  breaker.delete(k);
}

// ---------------------------------------------------------------------------
// Gemini's OpenAI-compatible endpoint rejects remote image links with
// "400 Request contains an invalid argument" — it only accepts inline base64
// data URLs. Every product photo is a link, so photo matching failed. We
// download each linked image once and inline it before sending to Gemini.
// ---------------------------------------------------------------------------
// The model downsizes images to ~768px anyway, so product photos are fetched as
// a small rendition. Full-size photos (some are 2-3 MB PNGs) exhausted the
// Worker's memory and killed the job before it could reply.
const INLINE_MAX_IMAGE_BYTES = 1_500_000;
const INLINE_TOTAL_BUDGET = 8 * 1024 * 1024; // keeps the request well under Gemini's 20 MB limit
const INLINE_CACHE_BYTES = 6 * 1024 * 1024;
const inlineCache = new Map<string, string | null>();
let inlineCacheBytes = 0;

function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  // HEIC/HEIF: "ftyp" box with a heic/heix/mif1 brand.
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (/^(heic|heix|hevc|mif1|msf1)$/.test(brand)) return "image/heic";
  }
  return null;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// Comparing product photos works fine at a small size, and a 320px WebP
// rendition is roughly 8-12 KB instead of several hundred KB, which is what
// makes the vision answer come back in seconds instead of tens of seconds.
const RENDITION_QUERY = "width=320&quality=50&resize=contain";
const RENDITION_ACCEPT = "image/webp,image/jpeg,*/*";

async function fetchBytes(url: string, headers: Record<string, string>): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function downloadImageBytes(url: string): Promise<Uint8Array | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // Our own /api/img proxy: read straight from storage (a Worker fetching its
  // own hostname loops back through Cloudflare and fails with 522). Ask
  // storage for a small rendition first, then the original as a fallback.
  if (parsed.pathname.startsWith("/api/img/")) {
    const path = decodeURIComponent(parsed.pathname.slice("/api/img/".length));
    const base = requireServerEnv("SUPABASE_URL").replace(/\/$/, "");
    const key = requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");
    const auth: Record<string, string> = { apikey: key, accept: RENDITION_ACCEPT };
    if (!key.startsWith("sb_")) auth.authorization = `Bearer ${key}`;
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const small = await fetchBytes(
      `${base}/storage/v1/render/image/authenticated/store-assets/${encoded}?${RENDITION_QUERY}`,
      auth,
    );
    if (small && small.length) return small;
    return fetchBytes(`${base}/storage/v1/object/store-assets/${encoded}`, auth);
  }
  // Public storage originals can be several megabytes each. Comparing photos
  // only needs a small rendition, and the smaller download is much faster.
  if (parsed.pathname.includes("/storage/v1/object/public/")) {
    const rendered = new URL(url);
    rendered.pathname = parsed.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    rendered.searchParams.set("width", "320");
    rendered.searchParams.set("quality", "50");
    rendered.searchParams.set("resize", "contain");
    const small = await fetchBytes(rendered.toString(), { accept: RENDITION_ACCEPT });
    if (small && small.length) return small;
  }
  return fetchBytes(url, { "user-agent": "Mozilla/5.0 (compatible; OrzenBot/1.0)" });
}

async function inlineImageUrl(url: string): Promise<string | null> {
  if (inlineCache.has(url)) return inlineCache.get(url) ?? null;
  const bytes = await downloadImageBytes(url);
  let out: string | null = null;
  if (bytes && bytes.length > 0 && bytes.length <= INLINE_MAX_IMAGE_BYTES) {
    const mime = sniffImageMime(bytes);
    if (mime) out = `data:${mime};base64,${toBase64(bytes)}`;
  }
  const size = out?.length ?? 0;
  while (inlineCache.size && inlineCacheBytes + size > INLINE_CACHE_BYTES) {
    const oldest = inlineCache.keys().next().value as string;
    inlineCacheBytes -= inlineCache.get(oldest)?.length ?? 0;
    inlineCache.delete(oldest);
  }
  if (size <= INLINE_CACHE_BYTES) {
    inlineCache.set(url, out);
    inlineCacheBytes += size;
  }
  return out;
}

/** Returns a copy of a chat-completions body with every remote image inlined. */
async function inlineRemoteImages(bodyObj: any): Promise<any> {
  if (!bodyObj || !Array.isArray(bodyObj.messages)) return bodyObj;
  const urls = new Set<string>();
  for (const m of bodyObj.messages) {
    if (!Array.isArray(m?.content)) continue;
    for (const p of m.content) {
      const u = p?.type === "image_url" ? (typeof p.image_url === "string" ? p.image_url : p.image_url?.url) : null;
      if (typeof u === "string" && /^https?:\/\//i.test(u)) urls.add(u);
    }
  }
  if (!urls.size) return bodyObj;
  const resolved = new Map<string, string | null>();
  await Promise.all([...urls].map(async (u) => resolved.set(u, await inlineImageUrl(u))));

  let budget = INLINE_TOTAL_BUDGET;
  const messages = bodyObj.messages.map((m: any) => {
    if (!Array.isArray(m?.content)) return m;
    const content = m.content.map((p: any) => {
      if (p?.type !== "image_url") return p;
      const u = typeof p.image_url === "string" ? p.image_url : p.image_url?.url;
      if (typeof u !== "string") return p;
      if (u.startsWith("data:")) {
        budget -= Math.floor(u.length * 0.75);
        return p;
      }
      const data = resolved.get(u);
      const size = data ? Math.floor(data.length * 0.75) : 0;
      if (!data || size > budget) return { type: "text", text: "[image unavailable]" };
      budget -= size;
      return { type: "image_url", image_url: { url: data } };
    });
    return { ...m, content };
  });
  return { ...bodyObj, messages };
}

/** Builds a fetch that walks the owner's key chain, retrying on failure. */
function makeRoutedFetch(candidates: Candidate[], onUse: (u: { provider: AiProviderKind; label: string }) => void) {
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

    let inlinedBody: any = null;
    let lastError = "AI request failed";
    // Whole-call budget: under provider overload, stop cycling keys/models
    // before the worker's request budget runs out (job then retries cleanly).
    const callStarted = Date.now();
    const CALL_BUDGET_MS = 25_000;
    const isChat = suffix.startsWith("/chat/completions");
    const needsVision = Array.isArray(bodyObj?.messages)
      && bodyObj.messages.some((m: any) =>
        Array.isArray(m?.content) && m.content.some((p: any) => p?.type === "image_url"),
      );
    const eligible = needsVision ? candidates.filter((c) => c.vision) : candidates;
    if (!eligible.length) throw new Error("No AI key on this site can read images. Enable a vision-capable key.");
    // Circuit breaker: skip keys whose primary model is currently "open",
    // unless every key is open (then try all anyway).
    const closed = eligible.filter((c) => !breakerOpen(`${c.label}|${c.modelId}`));
    const usable = closed.length ? [...closed, ...eligible.filter((c) => !closed.includes(c))] : eligible;
    for (const c of usable) {
      const headers = new Headers(init?.headers);
      headers.delete("authorization");
      headers.delete("Lovable-API-Key");
      headers.set("content-type", "application/json");
      headers.set("authorization", `Bearer ${c.apiKey}`);
      for (const [hk, hv] of Object.entries(c.headers)) headers.set(hk, hv);
      let payload = bodyObj;
      if (bodyObj && needsVision) {
        // Every provider accepts inline base64; Gemini accepts nothing else.
        inlinedBody ??= await inlineRemoteImages(bodyObj);
        payload = inlinedBody;
      }
      // Quotas and overload are per model, so a busy or exhausted model falls
      // through to a sibling model on the same key before the next key.
      const models = isChat && payload ? [c.modelId, ...c.fallbacks] : [c.modelId];
      let quotaHits = 0;
      let keyDead = false;
      for (const modelId of models) {
        const sendPayload = payload && c.provider === "gemini" ? withThoughtSignatures(payload) : payload;
        const body = sendPayload ? JSON.stringify({ ...sendPayload, model: modelId }) : (init?.body as any);
        try {
          const bKey = `${c.label}|${modelId}`;
          if (breakerOpen(bKey) && closed.length) continue;
          const left = CALL_BUDGET_MS - (Date.now() - callStarted);
          if (left < 1500) throw Object.assign(new Error(`AI busy: ${lastError}`), { budget: true });
          const timeout = AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, left));
          const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
          const res = await fetch(`${c.baseURL}${suffix}`, { ...init, headers, body, signal });
          if (res.ok) {
            breakerSuccess(bKey);
            onUse({ provider: c.provider, label: c.label });
            return res;
          }
          const text = await res.text().catch(() => "");
          lastError = `${c.label}: HTTP ${res.status} ${text.slice(0, 300)}`;
          if (!retryable(res.status)) {
            onUse({ provider: c.provider, label: c.label });
            return new Response(text, { status: res.status, headers: res.headers });
          }
          if (res.status >= 500 || res.status === 429) breakerFail(bKey, lastError);
          console.warn("[ai-route] switching:", lastError.slice(0, 160));
          const invalidKey = res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(text));
          if (invalidKey) {
            keyDead = true;
            break;
          }
          if (res.status === 429) quotaHits += 1;
        } catch (e) {
          if (init?.signal?.aborted || (e as any)?.budget) throw e;
          lastError = `${c.label}: ${(e as Error).name === "TimeoutError" ? `timeout ${ATTEMPT_TIMEOUT_MS}ms` : (e as Error).message}`;
          breakerFail(`${c.label}|${modelId}`, lastError);
          console.warn("[ai-route] switching:", lastError.slice(0, 160));
        }
      }
      // Only park a key for the day when the key itself is bad or every model
      // on it is out of quota. Overload or a request-shape problem is not the
      // key's fault.
      if (c.keyId && (keyDead || quotaHits === models.length)) {
        void markGeminiFailure(c.keyId, lastError);
      }
    }

    throw new Error(lastError);
  };
  return routedFetch;
}

/** Gemini rejects replayed tool calls without a thought_signature; the
 * OpenAI-compatible SDK drops them, so attach Google's documented bypass. */
function withThoughtSignatures(payload: any) {
  if (!Array.isArray(payload?.messages)) return payload;
  return {
    ...payload,
    messages: payload.messages.map((m: any) =>
      m?.role === "assistant" && Array.isArray(m.tool_calls)
        ? {
            ...m,
            tool_calls: m.tool_calls.map((t: any) =>
              t?.extra_content?.google?.thought_signature
                ? t
                : { ...t, extra_content: { google: { thought_signature: "skip_thought_signature_validator" } } },
            ),
          }
        : m,
    ),
  };
}

const NO_KEY_MESSAGE =
  "No AI provider is configured. Add an API key in Winner Admin → AI Control Center.";


/**
 * Builds one AI SDK model that routes through the owner's keys with fallback.
 * `modelId` is the gateway-style id stored in settings (e.g. "google/gemini-2.5-flash").
 */
export function buildRoutedModel(
  settings: any,
  modelId: string,
  opts?: { structuredOutputs?: boolean },
): ResolvedAi {
  const candidates = buildCandidates(settings, modelId);
  if (!candidates.length) throw new Error(NO_KEY_MESSAGE);
  let used: { provider: AiProviderKind; label: string } | null = null;
  const routedFetch = makeRoutedFetch(candidates, (u) => {
    used = u;
  });

  const provider = createOpenAICompatible({
    name: "orzen-ai",
    baseURL: SENTINEL_BASE,
    ...(opts?.structuredOutputs ? { supportsStructuredOutputs: true } : {}),
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

/** Convenience: a routed model for one model id (owner keys first, platform last). */
export async function routedModel(modelId: string) {
  const r = await resolveAiModel({ modelOverride: modelId });
  return r.model;
}

/** A routed model whose provider advertises JSON-schema structured output. */
export async function routedStructuredModel(modelId?: string) {
  const sb = admin();
  const { data: settings } = await sb.from("ai_global_settings").select("*").eq("id", 1).maybeSingle();
  const id = modelId || (settings as any)?.default_model || "google/gemini-2.5-flash";
  return buildRoutedModel(settings, id, { structuredOutputs: true }).model;
}

/**
 * Raw chat-completions call through the owner's key chain.
 * Used by the places that previously called the platform gateway directly.
 */
export async function routedChatCompletion(opts: {
  messages: any[];
  modelOverride?: string;
  temperature?: number;
  jsonOnly?: boolean;
  maxTokens?: number;
}): Promise<string | null> {
  const sb = admin();
  const { data: settings } = await sb.from("ai_global_settings").select("*").eq("id", 1).maybeSingle();
  const modelId = opts.modelOverride || (settings as any)?.default_model || "google/gemini-2.5-flash";
  const candidates = buildCandidates(settings, modelId);
  if (!candidates.length) return null;
  const routedFetch = makeRoutedFetch(candidates, () => {});
  const res = await routedFetch(`${SENTINEL_BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: opts.messages,
      ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
      // A hard output cap keeps the model from writing long explanations, which
      // is the slowest part of a photo answer.
      ...(typeof opts.maxTokens === "number" ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.jsonOnly ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const json = (await res.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  return json?.choices?.[0]?.message?.content?.trim() || null;
}

type VisionPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }
  | Record<string, any>;

/** Converts Responses-style content parts to chat-completions parts. */
export function toChatContent(parts: VisionPart[]): any[] {
  return parts.map((p: any) => {
    if (p?.type === "input_text") return { type: "text", text: p.text };
    if (p?.type === "input_image") return { type: "image_url", image_url: { url: p.image_url } };
    return p;
  });
}

/**
 * Vision call returning the model's raw text, routed through the owner's keys.
 * Accepts Responses-style content parts so existing prompts stay unchanged.
 */
export async function routedVisionText(
  parts: VisionPart[],
  opts?: { modelOverride?: string; jsonOnly?: boolean; maxTokens?: number },
): Promise<string> {
  const text = await routedChatCompletion({
    messages: [{ role: "user", content: toChatContent(parts) }],
    temperature: 0,
    maxTokens: opts?.maxTokens ?? 400,
    ...(opts?.modelOverride ? { modelOverride: opts.modelOverride } : {}),
    ...(opts?.jsonOnly ? { jsonOnly: true } : {}),
  });
  return text ?? "";
}

/**
 * Voice-note transcription on the owner's keys. Gemini's OpenAI-compatible
 * endpoint only accepts wav/mp3, but Messenger sends AAC in an mp4 box, so we
 * call Gemini's native endpoint with inline audio. Groq/OpenAI keys use their
 * Whisper-style transcription endpoint. Tries each enabled key in order.
 */
export async function routedTranscribeAudio(bytes: Uint8Array, mime: string): Promise<string | null> {
  const sb = admin();
  const { data: settings } = await sb.from("ai_global_settings").select("gemini_api_keys").eq("id", 1).maybeSingle();
  const { normalizeGeminiKeys, dhakaToday } = await import("./gemini-keys.server");
  const today = dhakaToday();
  const keys = normalizeGeminiKeys((settings as any)?.gemini_api_keys).filter(
    (k) => k.enabled && k.key && k.failed_on !== today,
  );
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const b64 = btoa(bin);
  const audioMime = mime.replace(/^video\//, "audio/") || "audio/mp4";
  const prompt =
    "Transcribe this customer voice message exactly as spoken (Bangla, Banglish or English). Return only the transcript text. If there is no speech, return an empty string.";
  for (const k of keys) {
    try {
      if (k.provider === "gemini") {
        for (const model of ["gemini-flash-lite-latest", "gemini-flash-latest"]) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(k.key)}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: audioMime, data: b64 } }] }],
                generationConfig: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
              }),
            },
          );
          if (!res.ok) continue;
          const j: any = await res.json().catch(() => null);
          const text = (j?.candidates?.[0]?.content?.parts ?? [])
            .map((p: any) => (p?.thought ? "" : p?.text ?? ""))
            .join("")
            .trim();
          if (text) return text;
        }
      } else if (k.provider === "groq" || k.provider === "openai") {
        const base = k.provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(bytes)], { type: audioMime }), "voice.m4a");
        form.append("model", k.provider === "groq" ? "whisper-large-v3-turbo" : "whisper-1");
        const res = await fetch(`${base}/audio/transcriptions`, {
          method: "POST",
          headers: { authorization: `Bearer ${k.key}` },
          body: form,
        });
        if (!res.ok) continue;
        const j: any = await res.json().catch(() => null);
        if (j?.text?.trim()) return j.text.trim();
      }
    } catch {
      // try next key
    }
  }
  return null;
}
