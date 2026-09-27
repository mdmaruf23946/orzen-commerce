// Serial rotation helpers for the platform's AI provider API keys.
//
// Keys may belong to different providers (Gemini, Groq, OpenRouter, OpenAI or
// any OpenAI-compatible endpoint). They are tried strictly in stored order:
// the first enabled key that has not failed today is used. A key that fails is
// paused for the rest of the day and the next key takes over. Every day the
// rotation restarts from the first key.
//
// The file keeps its historical name and `Gemini*` export names so existing
// imports stay valid; the data model is provider-agnostic.

export type KeyProvider = "gemini" | "groq" | "openrouter" | "openai" | "custom";

export type GeminiKey = {
  id: string;
  label: string;
  key: string;
  provider: KeyProvider;
  /** Only for provider "custom": OpenAI-compatible base URL. */
  base_url: string | null;
  /** Optional model override for this key (provider default when empty). */
  model: string | null;
  /** Whether this key's model can read images. */
  vision: boolean;
  enabled: boolean;
  failed_on: string | null; // Dhaka date (YYYY-MM-DD) of the last failure
  last_error: string | null;
};

export type ProviderPreset = {
  id: KeyProvider;
  name: string;
  baseURL: string;
  /** Default chat model for the provider. */
  model: string;
  /** Models tried on the same key when the first one is busy or out of quota. */
  fallbacks: string[];
  vision: boolean;
  keyHint: string;
  signupUrl: string;
};

export const PROVIDER_PRESETS: Record<KeyProvider, ProviderPreset> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-flash-latest",
    fallbacks: ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash-preview"],
    vision: true,
    keyHint: "AIza…",
    signupUrl: "https://aistudio.google.com/apikey",
  },
  groq: {
    id: "groq",
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    fallbacks: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    vision: true,
    keyHint: "gsk_…",
    signupUrl: "https://console.groq.com/keys",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    model: "google/gemini-2.0-flash-exp:free",
    fallbacks: ["meta-llama/llama-3.2-11b-vision-instruct:free", "meta-llama/llama-3.3-70b-instruct:free"],
    vision: true,
    keyHint: "sk-or-…",
    signupUrl: "https://openrouter.ai/keys",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    fallbacks: ["gpt-4o"],
    vision: true,
    keyHint: "sk-…",
    signupUrl: "https://platform.openai.com/api-keys",
  },
  custom: {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    baseURL: "",
    model: "",
    fallbacks: [],
    vision: false,
    keyHint: "your API key",
    signupUrl: "",
  },
};

export function providerPreset(p: string | null | undefined): ProviderPreset {
  return PROVIDER_PRESETS[(p as KeyProvider) in PROVIDER_PRESETS ? (p as KeyProvider) : "gemini"];
}

/** Clean a pasted key: drop whitespace/line breaks, quotes and a "Bearer " prefix. */
export function cleanApiKey(key: string): string {
  return key
    .trim()
    .replace(/^bearer\s+/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, "");
}

/** Guess the provider from the key's shape so a key can be added with just a name. */
export function guessProviderFromKey(key: string): KeyProvider {
  const k = cleanApiKey(key);
  if (/^AIza[\w-]{20,}$/.test(k)) return "gemini";
  // Newer Google AI Studio keys look like "AQ.Ab8R...".
  if (/^AQ\.[\w.-]{20,}$/.test(k)) return "gemini";
  if (/^gsk_[\w-]{20,}$/.test(k)) return "groq";
  if (/^sk-or-[\w-]{10,}$/.test(k)) return "openrouter";
  if (/^sk-(proj-|svcacct-|admin-)?[\w-]{20,}$/.test(k) && !/^sk-ant-/.test(k)) return "openai";
  return "custom";
}

/** Other well-known OpenAI-compatible AI services, tried when the key shape is not one of the presets. */
const OPENAI_COMPATIBLE_SERVICES: { name: string; baseURL: string; prefix?: RegExp }[] = [
  { name: "xAI Grok", baseURL: "https://api.x.ai/v1", prefix: /^xai-/ },
  { name: "Cerebras", baseURL: "https://api.cerebras.ai/v1", prefix: /^csk-/ },
  { name: "NVIDIA", baseURL: "https://integrate.api.nvidia.com/v1", prefix: /^nvapi-/ },
  { name: "Hugging Face", baseURL: "https://router.huggingface.co/v1", prefix: /^hf_/ },
  { name: "Fireworks", baseURL: "https://api.fireworks.ai/inference/v1", prefix: /^fw_/ },
  { name: "Perplexity", baseURL: "https://api.perplexity.ai", prefix: /^pplx-/ },
  { name: "DeepSeek", baseURL: "https://api.deepseek.com/v1", prefix: /^sk-/ },
  { name: "Mistral", baseURL: "https://api.mistral.ai/v1" },
  { name: "Together AI", baseURL: "https://api.together.xyz/v1" },
  { name: "SambaNova", baseURL: "https://api.sambanova.ai/v1" },
  { name: "Cohere", baseURL: "https://api.cohere.ai/compatibility/v1" },
  { name: "Novita", baseURL: "https://api.novita.ai/v3/openai" },
  { name: "DeepInfra", baseURL: "https://api.deepinfra.com/v1/openai" },
];

async function fetchWithTimeout(url: string, init: RequestInit, ms = 7000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Pick a sensible chat model from a provider's /models listing. */
function pickChatModel(ids: string[]): string | null {
  const chat = ids.filter(
    (id) => !/embed|whisper|tts|speech|audio|transcri|image|dall-e|moderation|guard|rerank|vision-preview-old/i.test(id),
  );
  if (!chat.length) return null;
  const prefs = [/flash/i, /llama-3\.3-70b/i, /mini/i, /instruct/i, /chat/i, /grok/i, /deepseek-chat/i, /small/i];
  for (const re of prefs) {
    const hit = chat.find((id) => re.test(id));
    if (hit) return hit;
  }
  return chat[0]!;
}

export type DetectedKey = {
  provider: KeyProvider;
  base_url: string | null;
  model: string | null;
  service: string;
};

/**
 * Work out which AI service a key belongs to. First by its shape, then by
 * asking each known service whether it accepts the key (a read-only
 * "list models" call). Returns null when no known service accepts it.
 */
export async function detectKeyProvider(rawKey: string): Promise<{ detected: DetectedKey | null; lastError: string | null }> {
  const key = cleanApiKey(rawKey);
  const guessed = guessProviderFromKey(key);
  let lastError: string | null = null;

  const tryPreset = async (p: KeyProvider): Promise<DetectedKey | null> => {
    const r = await testProviderKey({
      id: "probe", label: "probe", key, provider: p, base_url: null, model: null,
      vision: true, enabled: true, failed_on: null, last_error: null,
    });
    if (r.ok) return { provider: p, base_url: null, model: null, service: PROVIDER_PRESETS[p].name };
    lastError = r.error ?? lastError;
    return null;
  };

  if (guessed !== "custom") {
    const hit = await tryPreset(guessed);
    if (hit) return { detected: hit, lastError: null };
  }

  // Probe every other preset + known OpenAI-compatible service in parallel.
  const presetOrder = (["gemini", "groq", "openrouter", "openai"] as KeyProvider[]).filter((p) => p !== guessed);
  const services = [...OPENAI_COMPATIBLE_SERVICES].sort(
    (a, b) => Number(!!b.prefix?.test(key)) - Number(!!a.prefix?.test(key)),
  );

  const presetProbes = presetOrder.map((p) => tryPreset(p));
  const serviceProbes = services.map(async (s): Promise<DetectedKey | null> => {
    const res = await fetchWithTimeout(`${s.baseURL}/models`, { headers: { authorization: `Bearer ${key}` } });
    if (!res || !res.ok) return null;
    try {
      const body: any = await res.json();
      const list: any[] = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : Array.isArray(body) ? body : [];
      const ids = list.map((m) => String(m?.id ?? m?.name ?? "")).filter(Boolean);
      const model = pickChatModel(ids);
      if (!model) return null;
      return { provider: "custom", base_url: s.baseURL, model, service: s.name };
    } catch {
      return null;
    }
  });

  const results = await Promise.all([...presetProbes, ...serviceProbes]);
  const found = results.find((r) => r) ?? null;
  return { detected: found, lastError };
}

export function dhakaToday(): string {
  return new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
}

export function normalizeGeminiKeys(raw: unknown): GeminiKey[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((k) => k && typeof k === "object" && typeof (k as any).key === "string" && (k as any).key.trim())
    .map((k: any, i: number) => {
      const provider: KeyProvider = (k.provider as KeyProvider) in PROVIDER_PRESETS ? k.provider : "gemini";
      const preset = PROVIDER_PRESETS[provider];
      return {
        id: String(k.id ?? `key-${i + 1}`),
        label: String(k.label ?? `Key ${i + 1}`).slice(0, 60),
        key: String(k.key).trim(),
        provider,
        base_url: typeof k.base_url === "string" && k.base_url.trim() ? k.base_url.trim().replace(/\/$/, "") : null,
        model: typeof k.model === "string" && k.model.trim() ? k.model.trim() : null,
        vision: typeof k.vision === "boolean" ? k.vision : preset.vision,
        enabled: k.enabled !== false,
        failed_on: typeof k.failed_on === "string" ? k.failed_on : null,
        last_error: typeof k.last_error === "string" ? k.last_error.slice(0, 300) : null,
      };
    });
}

/** Base URL actually used for a key. */
export function keyBaseURL(k: GeminiKey): string {
  return (k.base_url || providerPreset(k.provider).baseURL).replace(/\/$/, "");
}

/** The key that should be used right now, following serial order. */
export function pickActiveGeminiKey(keys: GeminiKey[]): GeminiKey | null {
  const today = dhakaToday();
  return keys.find((k) => k.enabled && k.failed_on !== today) ?? null;
}

export function maskGeminiKey(key: string): string {
  return key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

/** Live check against the provider's own API. */
export async function testProviderKey(k: GeminiKey): Promise<{ ok: boolean; error?: string }> {
  try {
    if (k.provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k.key)}`,
        { method: "GET" },
      );
      if (res.ok) return { ok: true };
      return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    const base = keyBaseURL(k);
    if (!base) return { ok: false, error: "No base URL configured for this key." };
    // OpenRouter lists models without checking the key; /key does check it.
    const path = k.provider === "openrouter" || /openrouter\.ai/i.test(base) ? "/key" : "/models";
    const res = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${k.key}` } });
    if (res.ok) return { ok: true };
    return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Back-compat: live check for a raw Gemini key string. */
export async function testGeminiKey(key: string): Promise<{ ok: boolean; error?: string }> {
  return testProviderKey({ ...(normalizeGeminiKeys([{ key }])[0] as GeminiKey) });
}
