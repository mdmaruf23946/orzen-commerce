// Serial rotation helpers for the platform's Gemini API keys.
// Keys are tried strictly in stored order: the first enabled key that has not
// failed today is used. A key that fails is paused for the rest of the day and
// the next key takes over. Every day the rotation restarts from the first key.

export type GeminiKey = {
  id: string;
  label: string;
  key: string;
  enabled: boolean;
  failed_on: string | null; // Dhaka date (YYYY-MM-DD) of the last failure
  last_error: string | null;
};

export function dhakaToday(): string {
  return new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
}

export function normalizeGeminiKeys(raw: unknown): GeminiKey[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((k) => k && typeof k === "object" && typeof (k as any).key === "string" && (k as any).key.trim())
    .map((k: any, i: number) => ({
      id: String(k.id ?? `key-${i + 1}`),
      label: String(k.label ?? `Key ${i + 1}`).slice(0, 60),
      key: String(k.key).trim(),
      enabled: k.enabled !== false,
      failed_on: typeof k.failed_on === "string" ? k.failed_on : null,
      last_error: typeof k.last_error === "string" ? k.last_error.slice(0, 300) : null,
    }));
}

/** The key that should be used right now, following serial order. */
export function pickActiveGeminiKey(keys: GeminiKey[]): GeminiKey | null {
  const today = dhakaToday();
  return keys.find((k) => k.enabled && k.failed_on !== today) ?? null;
}

export function maskGeminiKey(key: string): string {
  return key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

/** Live check against the Gemini REST API. */
export async function testGeminiKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { method: "GET" },
    );
    if (res.ok) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
