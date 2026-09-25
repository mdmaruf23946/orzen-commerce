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

async function postSubscription(pageId: string, token: string, fields: string[]) {
  const body = new URLSearchParams({ subscribed_fields: fields.join(","), access_token: token });
  const r = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) {
    const err = j?.error ?? {};
    const e = new Error(err.message || `Subscribe failed (${r.status})`) as Error & { code?: number };
    e.code = err.code;
    throw e;
  }
  return true;
}

/**
 * Subscribes the page to our app, keeping any fields it is already subscribed
 * to (so the Facebook Page module's feed/mention subscription is not lost).
 * When Meta rejects the full list because a permission is missing (error #200),
 * we retry with only the Messenger fields so inbox messages still arrive.
 */
export async function ensurePageSubscribed(
  pageId: string,
  token: string,
  extraFields: string[] = [],
): Promise<{ ok: boolean; fields: string[]; error?: string }> {
  const { explainGraphError } = await import("@/lib/facebook-errors.server");
  let existing: string[] = [];
  try {
    existing = await getSubscribedFields(pageId, token);
  } catch {
    existing = [];
  }

  const attempts = [
    [...new Set([...existing, ...MESSENGER_FIELDS, ...extraFields])],
    [...new Set([...MESSENGER_FIELDS])],
    ["messages", "messaging_postbacks"],
    ["messages"],
  ];

  let lastError = "";
  for (const fields of attempts) {
    try {
      await postSubscription(pageId, token, fields);
      let after: string[] = fields;
      try {
        after = await getSubscribedFields(pageId, token);
      } catch {}
      return {
        ok: after.includes("messages"),
        fields: after,
        ...(after.includes("messages") ? {} : { error: lastError || undefined }),
      };
    } catch (e) {
      lastError = explainGraphError(e, "subscribe");
    }
  }
  return { ok: false, fields: existing, error: lastError };
}


// ---------------------------------------------------------------------------
// Self-healing for the card "Buy Now" button. Taps on card buttons arrive as
// `messaging_postbacks` webhook events, which Meta only delivers when BOTH the
// Page subscription and the App-level webhook subscription include that field.
// Checked at most once per 30 minutes per page (per worker isolate).
const lastPostbackCheck = new Map<string, number>();

export async function ensurePostbacksDelivered(opts: {
  pageId: string;
  token: string;
  appId?: string | null;
  appSecret?: string | null;
  verifyToken?: string | null;
}): Promise<{ page?: string; app?: string }> {
  const now = Date.now();
  const last = lastPostbackCheck.get(opts.pageId) ?? 0;
  if (now - last < 30 * 60 * 1000) return {};
  lastPostbackCheck.set(opts.pageId, now);
  const out: { page?: string; app?: string } = {};

  // 1) Page -> app subscription
  try {
    const fields = await getSubscribedFields(opts.pageId, opts.token);
    if (!fields.includes("messaging_postbacks")) {
      const r = await ensurePageSubscribed(opts.pageId, opts.token);
      out.page = r.fields.includes("messaging_postbacks") ? "fixed" : `missing:${r.error ?? ""}`;
    } else out.page = "ok";
  } catch (e) {
    out.page = `error:${(e as Error).message}`;
  }

  // 2) App-level webhook fields for the "page" object
  if (opts.appId && opts.appSecret) {
    const appAccess = `${opts.appId}|${opts.appSecret}`;
    try {
      const r = await fetch(
        `${GRAPH}/${encodeURIComponent(opts.appId)}/subscriptions?access_token=${encodeURIComponent(appAccess)}`,
      );
      const j: any = await r.json().catch(() => ({}));
      const pageSub = (j?.data ?? []).find((s: any) => s?.object === "page");
      const names: string[] = (pageSub?.fields ?? []).map((f: any) => String(f?.name ?? f));
      if (pageSub && !names.includes("messaging_postbacks") && pageSub.callback_url && opts.verifyToken) {
        const body = new URLSearchParams({
          object: "page",
          callback_url: pageSub.callback_url,
          verify_token: opts.verifyToken,
          fields: [...new Set([...names, "messages", "messaging_postbacks"])].join(","),
          include_values: "true",
          access_token: appAccess,
        });
        const pr = await fetch(`${GRAPH}/${encodeURIComponent(opts.appId)}/subscriptions`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
        });
        const pj: any = await pr.json().catch(() => ({}));
        out.app = pr.ok && pj?.success ? "fixed" : `failed:${pj?.error?.message ?? pr.status}`;
      } else out.app = pageSub ? (names.includes("messaging_postbacks") ? "ok" : "missing") : "no-page-sub";
    } catch (e) {
      out.app = `error:${(e as Error).message}`;
    }
  }
  return out;
}
