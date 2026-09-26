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
import { requireServerEnv } from "./server-env";

const SENTINEL_BASE = "https://ai-router.internal/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const OPENAI_BASE = "https://api.openai.com/v1";

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

/** Statuses that mean the key itself is the problem. */
function keyLevelFailure(status: number) {
  return status === 401 || status === 403 || status === 429;
}

// ---------------------------------------------------------------------------
// Gemini's OpenAI-compatible endpoint rejects remote image links with
// "400 Request contains an invalid argument" — it only accepts inline base64
// data URLs. Every product photo is a link, so photo matching failed. We
// download each linked image once and inline it before sending to Gemini.
// ---------------------------------------------------------------------------
const INLINE_MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const INLINE_TOTAL_BUDGET = 12 * 1024 * 1024; // keeps the request under Gemini's 20 MB limit
const inlineCache = new Map<string, string | null>();

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

async function downloadImageBytes(url: string): Promise<Uint8Array | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // Our own /api/img proxy: read straight from storage. A Worker fetching its
  // own hostname loops back through Cloudflare and fails (522).
  if (parsed.pathname.startsWith("/api/img/")) {
    const path = decodeURIComponent(parsed.pathname.slice("/api/img/".length));
    try {
      const { data, error } = await admin().storage.from("store-assets").download(path);
      if (!error && data) return new Uint8Array(await data.arrayBuffer());
    } catch {
      /* fall through to a normal fetch */
    }
  }
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; OrzenBot/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function inlineImageUrl(url: string): Promise<string | null> {
  if (inlineCache.has(url)) return inlineCache.get(url) ?? null;
  const bytes = await downloadImageBytes(url);
  let out: string | null = null;
  if (bytes && bytes.length > 0 && bytes.length <= INLINE_MAX_IMAGE_BYTES) {
    const mime = sniffImageMime(bytes);
    if (mime) out = `data:${mime};base64,${toBase64(bytes)}`;
  }
  if (inlineCache.size > 60) inlineCache.delete(inlineCache.keys().next().value as string);
  inlineCache.set(url, out);
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

    let geminiBody: any = null;
    let lastError = "AI request failed";
    for (const c of candidates) {
      const headers = new Headers(init?.headers);
      headers.delete("authorization");
      headers.delete("Lovable-API-Key");
      headers.set("content-type", "application/json");
      headers.set("authorization", `Bearer ${c.apiKey}`);
      let payload = bodyObj;
      if (bodyObj && c.provider === "gemini") {
        geminiBody ??= await inlineRemoteImages(bodyObj);
        payload = geminiBody;
      }
      const body = payload ? JSON.stringify({ ...payload, model: c.modelId }) : (init?.body as any);

      try {
        const res = await fetch(`${c.baseURL}${suffix}`, { ...init, headers, body });
        if (res.ok) {
          onUse({ provider: c.provider, label: c.label });
          return res;
        }
        const text = await res.text().catch(() => "");
        lastError = `${c.label}: HTTP ${res.status} ${text.slice(0, 300)}`;
        if (!retryable(res.status)) {
          onUse({ provider: c.provider, label: c.label });
          return new Response(text, { status: res.status, headers: res.headers });
        }
        // Only a key-level problem (bad key, revoked, quota) parks the key for
        // the day. Provider overload or a request-shape problem is not the
        // key's fault — move on to the next candidate without disabling it.
        if (c.provider === "gemini" && c.keyId && keyLevelFailure(res.status)) {
          void markGeminiFailure(c.keyId, lastError);
        }
      } catch (e) {
        lastError = `${c.label}: ${(e as Error).message}`;
      }
    }
    throw new Error(lastError);
  };
  return routedFetch;
}

const NO_KEY_MESSAGE =
  "No AI provider is configured. Add a Gemini or OpenAI key in Winner Admin → AI Control Center.";

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
  opts?: { modelOverride?: string; jsonOnly?: boolean },
): Promise<string> {
  const text = await routedChatCompletion({
    messages: [{ role: "user", content: toChatContent(parts) }],
    ...(opts?.modelOverride ? { modelOverride: opts.modelOverride } : {}),
    ...(opts?.jsonOnly ? { jsonOnly: true } : {}),
  });
  return text ?? "";
}
