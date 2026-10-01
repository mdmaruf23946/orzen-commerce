// Per-API-key token bookkeeping for the owner's AI keys.
// Recording never throws and never delays an AI reply.
import { cached, invalidate } from "./ttl-cache.server";

type Admin = any;
async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Admin;
}

export function dhakaDayStartISO(): string {
  const now = new Date(Date.now() + 6 * 3600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 6 * 3600_000).toISOString();
}
export function dhakaMonthStartISO(): string {
  const now = new Date(Date.now() + 6 * 3600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 6 * 3600_000).toISOString();
}

function findUsage(text: string): { p: number; c: number } | null {
  // Works for plain JSON and SSE streams (usage is in the last chunk).
  const re = /"usage"\s*:\s*\{[^{}]*\}/g;
  let last: string | null = null;
  for (const m of text.matchAll(re)) last = m[0];
  if (!last) return null;
  try {
    const u = JSON.parse(`{${last}}`).usage ?? {};
    const p = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
    const c = Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
    if (!p && !c) return null;
    return { p, c };
  } catch {
    return null;
  }
}

/** Reads a clone of a successful response and stores tokens + provider quota headers. */
export function recordKeyUsage(
  keyId: string,
  provider: string,
  model: string,
  res: Response,
  requestBody: string | null,
): void {
  const headers = res.headers;
  let clone: Response | null = null;
  try {
    clone = res.clone();
  } catch {
    clone = null;
  }
  void (async () => {
    try {
      const sb = await admin();
      let usage: { p: number; c: number } | null = null;
      if (clone) {
        const text = await clone.text().catch(() => "");
        usage = findUsage(text);
        if (!usage) {
          // Provider sent no usage — rough estimate (~4 chars per token).
          usage = { p: Math.ceil((requestBody?.length ?? 0) / 4), c: Math.ceil(text.length / 8) };
        }
      }
      await sb.from("ai_key_usage").insert({
        key_id: keyId,
        provider,
        model: model.slice(0, 120),
        prompt_tokens: usage?.p ?? 0,
        completion_tokens: usage?.c ?? 0,
        ok: true,
      });
      // Groq (and some others) report the remaining daily token budget.
      const rem = headers.get("x-ratelimit-remaining-tokens");
      const lim = headers.get("x-ratelimit-limit-tokens");
      if (rem !== null && lim !== null) {
        const reset = headers.get("x-ratelimit-reset-tokens");
        const secs = reset ? parseResetSecs(reset) : null;
        await sb.from("ai_key_quota").upsert({
          key_id: keyId,
          remaining_tokens: Number(rem),
          limit_tokens: Number(lim),
          unit: "tokens",
          reset_at: secs !== null ? new Date(Date.now() + secs * 1000).toISOString() : null,
          source: "header",
          checked_at: new Date().toISOString(),
        });
      }
      invalidate("ai-key-totals");
    } catch {
      /* bookkeeping must never break chat */
    }
  })();
}

function parseResetSecs(v: string): number | null {
  // Formats: "7.66s", "2m59.56s", "1h2m3s", "120"
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
  let total = 0;
  let matched = false;
  for (const m of v.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    matched = true;
    const n = Number(m[1]);
    total += m[2] === "h" ? n * 3600 : m[2] === "m" ? n * 60 : m[2] === "ms" ? n / 1000 : n;
  }
  return matched ? total : null;
}

export type KeyTotals = Record<string, { today: number; month: number; requests: number; last: string | null }>;

/** Token totals per key for today (Dhaka) and this month. */
export async function loadKeyTotals(sb?: Admin): Promise<KeyTotals> {
  const client = sb ?? (await admin());
  const monthStart = dhakaMonthStartISO();
  const dayStart = dhakaDayStartISO();
  const out: KeyTotals = {};
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from("ai_key_usage")
      .select("key_id,prompt_tokens,completion_tokens,created_at")
      .gte("created_at", monthStart)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data as any[]) {
      const t = (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0);
      const e = (out[r.key_id] ??= { today: 0, month: 0, requests: 0, last: null });
      e.month += t;
      e.requests += 1;
      if (r.created_at >= dayStart) e.today += t;
      if (!e.last) e.last = r.created_at;
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}

/** Key ids whose owner-set daily/monthly limit is used up (cached 60s). */
export async function overLimitKeyIds(
  limits: { id: string; daily: number | null; monthly: number | null }[],
): Promise<Set<string>> {
  const withLimit = limits.filter((l) => l.daily || l.monthly);
  if (!withLimit.length) return new Set();
  try {
    const totals = await cached("ai-key-totals", 60_000, () => loadKeyTotals());
    const out = new Set<string>();
    for (const l of withLimit) {
      const t = totals[l.id];
      if (!t) continue;
      if ((l.daily && t.today >= l.daily) || (l.monthly && t.month >= l.monthly)) out.add(l.id);
    }
    return out;
  } catch {
    return new Set();
  }
}

/** Live balance from OpenRouter (credits in USD). */
export async function refreshOpenRouterQuota(keyId: string, apiKey: string, sb?: Admin) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return;
    const j: any = await res.json();
    const d = j?.data ?? {};
    const client = sb ?? (await admin());
    await client.from("ai_key_quota").upsert({
      key_id: keyId,
      remaining_tokens: d.limit_remaining ?? null,
      limit_tokens: d.limit ?? null,
      unit: d.is_free_tier ? "usd_free" : "usd",
      reset_at: null,
      source: "provider",
      checked_at: new Date().toISOString(),
    });
  } catch {
    /* ignore */
  }
}
