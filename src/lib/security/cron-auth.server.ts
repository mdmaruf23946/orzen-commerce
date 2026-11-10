/** Verifies the x-cron-token header against the DB-held scheduler token. */
export async function verifyCronRequest(request: Request): Promise<boolean> {
  const got = request.headers.get("x-cron-token") ?? "";
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const envSecret = process.env.CRON_SECRET;
  if (envSecret && bearer && bearer === envSecret) return true;
  if (!got || got.length < 16) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("internal_cron_tokens")
    .select("token")
    .eq("name", "default")
    .maybeSingle();
  return !!data?.token && data.token === got;
}
