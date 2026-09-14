// Server-only helpers for the standalone Facebook Page module.
// Completely independent from the Messenger AI Agent code path.

export const GRAPH = "https://graph.facebook.com/v19.0";

/** Meta permissions this module can make use of. */
export const FB_PAGE_SCOPES = {
  posts: "pages_manage_posts",
  read: "pages_read_engagement",
  engagement: "pages_manage_engagement",
  metadata: "pages_manage_metadata",
  messaging: "pages_messaging",
} as const;

export type Capability =
  | "read_posts"
  | "create_post"
  | "edit_post"
  | "delete_post"
  | "read_comments"
  | "reply_comment"
  | "hide_comment"
  | "delete_comment"
  | "block_user"
  | "private_reply";

export const CAPABILITY_SCOPE: Record<Capability, string> = {
  read_posts: FB_PAGE_SCOPES.read,
  create_post: FB_PAGE_SCOPES.posts,
  edit_post: FB_PAGE_SCOPES.posts,
  delete_post: FB_PAGE_SCOPES.posts,
  read_comments: FB_PAGE_SCOPES.read,
  reply_comment: FB_PAGE_SCOPES.engagement,
  hide_comment: FB_PAGE_SCOPES.engagement,
  delete_comment: FB_PAGE_SCOPES.engagement,
  block_user: FB_PAGE_SCOPES.metadata,
  private_reply: FB_PAGE_SCOPES.messaging,
};

/**
 * Derives which UI actions are actually usable from the scopes Meta reported
 * for the stored page token. When the scope list is unknown (empty) we cannot
 * prove support, so everything except reads is reported unsupported.
 */
export function capabilities(permissions: string[] | null | undefined) {
  const granted = new Set((permissions ?? []).map((p) => String(p)));
  const out = {} as Record<Capability, boolean>;
  for (const [cap, scope] of Object.entries(CAPABILITY_SCOPE) as [Capability, string][]) {
    out[cap] = granted.has(scope);
  }
  return out;
}

export type GraphError = { message: string; code?: number };

async function graph<T = any>(
  path: string,
  opts: { token: string; method?: "GET" | "POST" | "DELETE"; params?: Record<string, string | undefined>; body?: Record<string, string> },
): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(opts.params ?? {})) if (v != null) url.searchParams.set(k, v);
  url.searchParams.set("access_token", opts.token);

  const init: RequestInit = { method: opts.method ?? "GET" };
  if (opts.body) {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.body)) if (v != null) form.set(k, v);
    init.body = form;
    init.headers = { "content-type": "application/x-www-form-urlencoded" };
  }

  const res = await fetch(url.toString(), init);
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    const err = json?.error ?? {};
    const message: string = err.message || `Facebook request failed (${res.status})`;
    const e = new Error(message) as Error & { code?: number; subcode?: number };
    e.code = err.code;
    e.subcode = err.error_subcode;
    throw e;
  }
  return json as T;
}

export const graphGet = <T = any>(path: string, token: string, params?: Record<string, string | undefined>) =>
  graph<T>(path, { token, method: "GET", params });

export const graphPost = <T = any>(path: string, token: string, body?: Record<string, string>) =>
  graph<T>(path, { token, method: "POST", body });

export const graphDelete = <T = any>(path: string, token: string) =>
  graph<T>(path, { token, method: "DELETE" });

export function pagePicture(pageId: string) {
  return `${GRAPH}/${encodeURIComponent(pageId)}/picture?type=large`;
}

export function userPicture(userId: string) {
  return `${GRAPH}/${encodeURIComponent(userId)}/picture?type=square`;
}

/** Reads the granted scopes + expiry for a page token using an app access token. */
export async function debugToken(pageToken: string, appId: string, appSecret: string) {
  const j: any = await graphGet("/debug_token", `${appId}|${appSecret}`, { input_token: pageToken });
  const info = j?.data ?? {};
  const exp = Number(info.expires_at || 0);
  return {
    scopes: Array.isArray(info.scopes) ? (info.scopes as string[]) : [],
    expires_at: exp > 0 ? new Date(exp * 1000).toISOString() : null,
    valid: info.is_valid !== false,
  };
}

/**
 * Best-effort scope discovery when no app secret is available: Meta exposes the
 * page's granted tasks via `/me?fields=tasks`, which maps onto the scopes we use.
 */
export async function inferScopes(pageId: string, token: string): Promise<string[]> {
  try {
    const j: any = await graphGet(`/${encodeURIComponent(pageId)}`, token, { fields: "tasks" });
    const tasks: string[] = Array.isArray(j?.tasks) ? j.tasks : [];
    const s = new Set<string>();
    if (tasks.includes("CREATE_CONTENT")) s.add(FB_PAGE_SCOPES.posts);
    if (tasks.includes("MODERATE")) {
      s.add(FB_PAGE_SCOPES.engagement);
      s.add(FB_PAGE_SCOPES.messaging);
    }
    if (tasks.includes("MANAGE")) {
      s.add(FB_PAGE_SCOPES.posts);
      s.add(FB_PAGE_SCOPES.engagement);
      s.add(FB_PAGE_SCOPES.metadata);
      s.add(FB_PAGE_SCOPES.messaging);
    }
    if (tasks.includes("ANALYZE") || tasks.length) s.add(FB_PAGE_SCOPES.read);
    return [...s];
  } catch {
    return [];
  }
}

/** Loads the store's Facebook Page row plus a decrypted page token. */
export async function loadPageContext(supabase: any, storeId: string) {
  const { data } = await supabase
    .from("facebook_page_integrations")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!data) return { row: null as any, token: null as string | null };
  let token: string | null = null;
  if (data.page_access_token_encrypted) {
    try {
      const { decryptJSON } = await import("@/lib/crypto/credentials.server");
      token = decryptJSON<string>(data.page_access_token_encrypted);
    } catch {
      token = null;
    }
  }
  return { row: data, token };
}

/** Throws a friendly error when the page isn't connected or the capability is missing. */
export function requireCapability(row: any, cap: Capability) {
  if (!row || row.status !== "connected") throw new Error("Facebook Page is not connected.");
  const caps = capabilities(row.permissions as string[]);
  if (!caps[cap]) {
    throw new Error(
      `This action requires the "${CAPABILITY_SCOPE[cap]}" permission on your Facebook Page. Reconnect the page after granting it.`,
    );
  }
}

export function attachmentOf(post: any): { type: string; url: string | null; thumb: string | null; target: string | null } {
  const a = post?.attachments?.data?.[0] ?? null;
  const media = a?.media ?? null;
  return {
    type: a?.type ?? (post?.full_picture ? "photo" : "status"),
    url: post?.full_picture ?? media?.image?.src ?? null,
    thumb: media?.image?.src ?? post?.full_picture ?? null,
    target: a?.target?.url ?? a?.url ?? null,
  };
}

/**
 * Subscribes the page to our Meta app so webhook events are actually delivered.
 * Without this, the callback URL + verify token alone never receive anything.
 */
export async function subscribePageToApp(pageId: string, token: string) {
  // Merge with whatever the page is already subscribed to, so enabling Page
  // events never removes Messenger's `messages` subscription (and vice versa).
  const existing = await pageSubscribedFields(pageId, token);
  const fields = [...new Set([...existing, "feed", "mention"])];
  return graphPost(`/${encodeURIComponent(pageId)}/subscribed_apps`, token, {
    subscribed_fields: fields.join(","),
  });
}

/** Returns the fields the page is currently subscribed to (empty when not subscribed). */
export async function pageSubscribedFields(pageId: string, token: string): Promise<string[]> {
  try {
    const j: any = await graphGet(`/${encodeURIComponent(pageId)}/subscribed_apps`, token, {
      fields: "subscribed_fields",
    });
    const rows: any[] = Array.isArray(j?.data) ? j.data : [];
    const set = new Set<string>();
    for (const r of rows) for (const f of r?.subscribed_fields ?? []) set.add(String(f));
    return [...set];
  } catch {
    return [];
  }
}
