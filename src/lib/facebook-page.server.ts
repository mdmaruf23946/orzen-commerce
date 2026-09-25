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

export type VerifiedCaps = Partial<Record<Capability, boolean>>;

/**
 * Which UI actions are usable. The scope list Meta reports for a page token is
 * unreliable (page tokens frequently work for endpoints their scope list never
 * mentions), so it is only one signal:
 *
 *  - a live probe that succeeded  -> allowed
 *  - a live probe that was refused -> blocked
 *  - the scope is granted          -> allowed
 *  - otherwise                     -> allowed optimistically; Facebook itself
 *    decides and we translate its error for the merchant.
 */
export function capabilities(permissions: string[] | null | undefined, verified?: VerifiedCaps | null) {
  const granted = new Set((permissions ?? []).map((p) => String(p)));
  const v = (verified ?? {}) as VerifiedCaps;
  const out = {} as Record<Capability, boolean>;
  for (const [cap, scope] of Object.entries(CAPABILITY_SCOPE) as [Capability, string][]) {
    out[cap] = typeof v[cap] === "boolean" ? (v[cap] as boolean) : granted.has(scope) ? true : true;
  }
  return out;
}

/** Tri-state view used by the settings screen: true / false / null (unknown). */
export function capabilityStates(permissions: string[] | null | undefined, verified?: VerifiedCaps | null) {
  const granted = new Set((permissions ?? []).map((p) => String(p)));
  const v = (verified ?? {}) as VerifiedCaps;
  const out = {} as Record<Capability, boolean | null>;
  for (const [cap, scope] of Object.entries(CAPABILITY_SCOPE) as [Capability, string][]) {
    out[cap] = typeof v[cap] === "boolean" ? (v[cap] as boolean) : granted.has(scope) ? true : null;
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
  const states = capabilityStates(row.permissions as string[], row.permissions_verified as VerifiedCaps);
  // Only block when a live check actually proved the action is refused.
  if (states[cap] === false) {
    throw new Error(
      `Facebook refused this action for your Page token. It needs the "${CAPABILITY_SCOPE[cap]}" permission — regenerate the Page access token with that permission granted, then reconnect the Page in Page Settings.`,
    );
  }
}

/**
 * Runs read-only Graph calls to find out what this token can really do, so the
 * UI stops guessing from the (often incomplete) scope list.
 */
export async function probeCapabilities(pageId: string, token: string): Promise<VerifiedCaps> {
  const out: VerifiedCaps = {};
  const isPermissionError = (e: any) => [10, 200, 283, 299, 190, 3].includes(Number(e?.code));

  let firstPostId: string | null = null;
  try {
    const j: any = await graphGet(`/${encodeURIComponent(pageId)}/posts`, token, { fields: "id", limit: "1" });
    out.read_posts = true;
    firstPostId = j?.data?.[0]?.id ?? null;
  } catch (e) {
    if (isPermissionError(e)) out.read_posts = false;
  }

  try {
    const target = firstPostId ?? pageId;
    await graphGet(`/${encodeURIComponent(target)}/comments`, token, { fields: "id", limit: "1" });
    out.read_comments = true;
  } catch (e) {
    if (isPermissionError(e)) out.read_comments = false;
  }

  try {
    await graphGet(`/${encodeURIComponent(pageId)}/blocked`, token, { limit: "1" });
    out.block_user = true;
  } catch (e) {
    if (isPermissionError(e)) out.block_user = false;
  }

  try {
    await graphGet(`/${encodeURIComponent(pageId)}/conversations`, token, { limit: "1" });
    out.private_reply = true;
  } catch (e) {
    if (isPermissionError(e)) out.private_reply = false;
  }

  return out;
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
 * Feed/mention need `pages_manage_metadata`; when that scope is missing Meta
 * rejects the whole call (#200), so we retry with the fields we can keep.
 */
export async function subscribePageToApp(pageId: string, token: string) {
  // Merge with whatever the page is already subscribed to, so enabling Page
  // events never removes Messenger's `messages` subscription (and vice versa).
  const existing = await pageSubscribedFields(pageId, token);
  const attempts = [
    [...new Set([...existing, "feed", "mention"])],
    [...new Set([...existing, "feed"])],
    existing,
  ].filter((f) => f.length);

  const { explainGraphError } = await import("@/lib/facebook-errors.server");
  let lastError: unknown = new Error("Could not enable event delivery for this Page.");
  for (const fields of attempts) {
    try {
      return await graphPost(`/${encodeURIComponent(pageId)}/subscribed_apps`, token, {
        subscribed_fields: fields.join(","),
      });
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(explainGraphError(lastError, "subscribe"));
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

/**
 * Single crossing point between the Messenger agent and the Facebook Page agent.
 *
 * The merchant connects the Page once on the Messenger screen; this mirrors the
 * exact same credentials into `facebook_page_integrations` so the posts/comments
 * agent is live without a second connect step. Always store-scoped by the
 * caller's authenticated storeId. Never throws — a Facebook problem must never
 * block the Messenger connection.
 */
export async function syncFacebookPageFromMessenger(
  supabase: any,
  storeId: string,
  creds: {
    page_id: string;
    token: string;
    app_id?: string | null;
    app_secret?: string | null;
    /** Dedicated Page token for posts/comments. When set it overrides the Messenger token. */
    fb_token?: string | null;
  },
): Promise<{ connected: boolean; page_name: string | null; verified: any | null; error: string | null; skipped?: boolean; manual_token?: boolean }> {
  try {
    const { encryptJSON, decryptJSON } = await import("@/lib/crypto/credentials.server");
    const { row } = await loadPageContext(supabase, storeId);

    // Token precedence: explicitly supplied Page token > previously saved
    // dedicated Page token > mirrored Messenger token.
    let effectiveToken = creds.token;
    let manualToken = false;
    if (creds.fb_token) {
      effectiveToken = creds.fb_token;
      manualToken = true;
    } else if (row?.manual_token && row?.page_access_token_encrypted) {
      try {
        effectiveToken = decryptJSON<string>(row.page_access_token_encrypted);
        manualToken = true;
      } catch {
        /* fall back to the Messenger token */
      }
    }

    let pageName: string | null = row?.page_name ?? null;
    try {
      const page: any = await graphGet(`/${encodeURIComponent(creds.page_id)}`, effectiveToken, { fields: "name" });
      pageName = page?.name ?? pageName;
    } catch {
      /* keep the previous name */
    }

    let permissions: string[] = [];
    let expiresAt: string | null = null;
    if (creds.app_id && creds.app_secret) {
      try {
        const info = await debugToken(effectiveToken, creds.app_id, creds.app_secret);
        permissions = info.scopes;
        expiresAt = info.expires_at;
      } catch {
        /* fall back to task inference */
      }
    }
    if (!permissions.length) {
      try {
        permissions = await inferScopes(creds.page_id, effectiveToken);
      } catch {
        permissions = (row?.permissions as string[]) ?? [];
      }
    }

    const { error } = await supabase.from("facebook_page_integrations").upsert(
      {
        store_id: storeId,
        page_id: creds.page_id,
        page_name: pageName,
        page_picture_url: pagePicture(creds.page_id),
        page_access_token_encrypted: encryptJSON(effectiveToken),
        manual_token: manualToken,
        app_id: creds.app_id || null,
        app_secret_encrypted: creds.app_secret
          ? encryptJSON(creds.app_secret)
          : (row?.app_secret_encrypted ?? null),
        permissions,
        token_expires_at: expiresAt,
        verify_token: row?.verify_token ?? crypto.randomUUID().replace(/-/g, ""),
        status: "connected",
        connected_at: row?.connected_at ?? new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "store_id" },
    );
    if (error) throw new Error(error.message);

    try {
      await subscribePageToApp(creds.page_id, creds.token);
    } catch {
      /* messaging still works; page events may need pages_manage_metadata */
    }

    let verified: any = null;
    try {
      verified = await probeCapabilities(creds.page_id, creds.token);
      await supabase
        .from("facebook_page_integrations")
        .update({ permissions_verified: verified, permissions_checked_at: new Date().toISOString() })
        .eq("store_id", storeId);
    } catch {
      /* capability probing is advisory */
    }

    return { connected: true, page_name: pageName, verified, error: null };
  } catch (e) {
    const message = (e as Error).message;
    try {
      await supabase
        .from("facebook_page_integrations")
        .update({ last_error: message })
        .eq("store_id", storeId);
    } catch {}
    return { connected: false, page_name: null, verified: null, error: message };
  }
}
