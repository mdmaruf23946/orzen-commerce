import { buildPushHTTPRequest } from "@pushforge/builder";

/** Sends pending push_outbox rows to every subscribed device of that store. Never throws. */
export async function dispatchPush(limit = 30) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const { data: key } = await sb.from("push_vapid").select("private_jwk").eq("id", 1).maybeSingle();
  if (!key?.private_jwk) return { sent: 0 };
  const { data: rows } = await sb
    .from("push_outbox").select("*").is("sent_at", null)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString())
    .order("created_at").limit(limit);
  if (!rows?.length) return { sent: 0 };
  let icon: string | undefined;
  try {
    const { data: b } = await sb.rpc("get_platform_branding");
    const a = b?.assets ?? {};
    const u = a.appIcon192?.url ?? a.appIcon512?.url ?? a.favicon?.url;
    if (u) icon = u.startsWith("http") ? u : `https://orzen.top${u}`;
  } catch { /* fall back to worker default */ }
  // Claim first so parallel wakes don't double-send.
  const ids = rows.map((r: any) => r.id);
  const { data: claimed } = await sb.from("push_outbox").update({ sent_at: new Date().toISOString() })
    .in("id", ids).is("sent_at", null).select("id");
  const mine = new Set((claimed ?? []).map((r: any) => r.id));
  let sent = 0;
  for (const row of rows.filter((r: any) => mine.has(r.id))) {
    const { data: subs } = await sb.from("push_subscriptions").select("id,endpoint,p256dh,auth,failures").eq("store_id", row.store_id).limit(50);
    await Promise.all((subs ?? []).map(async (s: any) => {
      try {
        const req = await buildPushHTTPRequest({
          privateJWK: key.private_jwk,
          subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message: {
            payload: { title: row.title, body: row.body, url: row.url, tag: row.tag, kind: row.kind },
            adminContact: "mailto:support@orzen.top",
            options: { ttl: 3600, urgency: "high" },
          },
        });
        const res = await fetch(req.endpoint, { method: "POST", headers: req.headers, body: req.body });
        if (res.status === 404 || res.status === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);
        else if (res.ok) { sent++; await sb.from("push_subscriptions").update({ failures: 0, last_success_at: new Date().toISOString() }).eq("id", s.id); }
        else if ((s.failures ?? 0) >= 9) await sb.from("push_subscriptions").delete().eq("id", s.id);
        else await sb.from("push_subscriptions").update({ failures: (s.failures ?? 0) + 1 }).eq("id", s.id);
      } catch (e) { console.error("push send failed", e); }
    }));
  }
  return { sent };
}
