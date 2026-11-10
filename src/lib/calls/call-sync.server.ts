// Orzen Call live-data API helpers. Auth = store's Orzen Call verification
// secret in the `x-orzen-secret` header; every query is scoped to that store.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Orzen-Secret, Authorization, Accept",
  "Access-Control-Max-Age": "86400",
} as const;

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS },
  });
}

export const preflight = () => new Response(null, { status: 204, headers: CORS });

/** Returns the store id that owns this secret, or null. */
export async function authStore(request: Request) {
  const key = (request.headers.get("x-orzen-secret") ?? "").trim();
  if (key.length < 16 || key.length > 200) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("voice_provider_connections")
    .select("store_id,encrypted_token,status,account_info")
    .eq("provider", "orzen_call")
    .eq("status", "connected")
    .eq("encrypted_token", key)
    .limit(2);
  const rows = (data ?? []) as any[];
  if (rows.length !== 1) return null;
  const token = rows[0].encrypted_token as string;
  const { timingSafeEqual } = await import("node:crypto");
  if (token.length !== key.length || !timingSafeEqual(Buffer.from(token), Buffer.from(key))) return null;
  return { storeId: rows[0].store_id as string, info: (rows[0].account_info ?? {}) as Record<string, any>, supabaseAdmin };
}

export const unauthorized = () => json({ ok: false, error: "unauthorized" }, 401);
