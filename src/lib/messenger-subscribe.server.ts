// Ensures the connected Facebook Page actually delivers Messenger events to our
// app. Without an active `subscribed_apps` subscription Meta never calls the
// webhook, so messages silently never arrive.
const GRAPH = "https://graph.facebook.com/v19.0";

export const MESSENGER_FIELDS = [
  "messages",
  "messaging_postbacks",
  "messaging_optins",
  "message_deliveries",
  "message_reads",
  "messaging_referrals",
];

export async function getSubscribedFields(pageId: string, token: string): Promise<string[]> {
  const r = await fetch(
    `${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps?fields=subscribed_fields&access_token=${encodeURIComponent(token)}`,
  );
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Subscription check failed (${r.status})`);
  const set = new Set<string>();
  for (const row of j?.data ?? []) for (const f of row?.subscribed_fields ?? []) set.add(String(f));
  return [...set];
}

/**
 * Subscribes the page to our app, keeping any fields it is already subscribed
 * to (so the Facebook Page module's feed/mention subscription is not lost).
 */
export async function ensurePageSubscribed(
  pageId: string,
  token: string,
  extraFields: string[] = [],
): Promise<{ ok: boolean; fields: string[]; error?: string }> {
  try {
    let existing: string[] = [];
    try {
      existing = await getSubscribedFields(pageId, token);
    } catch {
      existing = [];
    }
    const wanted = [...new Set([...existing, ...MESSENGER_FIELDS, ...extraFields])];
    const body = new URLSearchParams({
      subscribed_fields: wanted.join(","),
      access_token: token,
    });
    const r = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j?.error) {
      return { ok: false, fields: existing, error: j?.error?.message || `Subscribe failed (${r.status})` };
    }
    let after: string[] = wanted;
    try {
      after = await getSubscribedFields(pageId, token);
    } catch {}
    return { ok: after.includes("messages"), fields: after };
  } catch (e) {
    return { ok: false, fields: [], error: (e as Error).message };
  }
}
