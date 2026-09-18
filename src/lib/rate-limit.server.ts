// Server-only IP / identifier rate limiting backed by Postgres.
// Fixed-window counters via the `rate_limit_hit` RPC (service role only).
// Fail-open: if the database call errors we never block real customers.

export type RateRule = { limit: number; windowSec: number };

export const RATE_RULES = {
  landing_order: { limit: 10, windowSec: 600 },
  checkout: { limit: 15, windowSec: 600 },
  auth: { limit: 10, windowSec: 900 },
  ai_chat: { limit: 30, windowSec: 600 },
  contact: { limit: 5, windowSec: 600 },
} as const satisfies Record<string, RateRule>;

export type RateRuleName = keyof typeof RATE_RULES;

export function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface RateResult {
  allowed: boolean;
  count: number;
  retryAfter: number;
}

/**
 * Count one hit for `rule` against `subject` (usually an IP, sometimes a phone
 * number or user id). Returns `allowed: false` once the window limit is passed.
 */
export async function checkRateLimit(
  rule: RateRuleName,
  subject: string,
  overrides?: Partial<RateRule>,
): Promise<RateResult> {
  const cfg = { ...RATE_RULES[rule], ...(overrides ?? {}) };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("rate_limit_hit", {
      _key: `${rule}:${subject}`.slice(0, 200),
      _limit: cfg.limit,
      _window_sec: cfg.windowSec,
    });
    if (error || !data) return { allowed: true, count: 0, retryAfter: 0 };
    const row = data as { allowed: boolean; count: number; retry_after: number };
    return {
      allowed: !!row.allowed,
      count: Number(row.count) || 0,
      retryAfter: Number(row.retry_after) || cfg.windowSec,
    };
  } catch {
    return { allowed: true, count: 0, retryAfter: 0 };
  }
}

export const TOO_MANY_MESSAGE_BN =
  "অনেক বেশি অনুরোধ পাঠানো হয়েছে। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।";

export function tooManyResponse(retryAfter: number, extraHeaders?: HeadersInit): Response {
  return new Response(
    JSON.stringify({ ok: false, error: TOO_MANY_MESSAGE_BN, retry_after: retryAfter }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(Math.max(1, retryAfter)),
        ...(extraHeaders as Record<string, string> | undefined),
      },
    },
  );
}

/** Convenience wrapper for server routes: returns a 429 Response or null. */
export async function guardRequest(
  rule: RateRuleName,
  request: Request,
  extraHeaders?: HeadersInit,
): Promise<Response | null> {
  const res = await checkRateLimit(rule, clientIp(request));
  return res.allowed ? null : tooManyResponse(res.retryAfter, extraHeaders);
}
