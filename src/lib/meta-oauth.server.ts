// Server-only helpers for the "Auto Connect" (Facebook Login / Meta OAuth)
// flow used by the Messenger and WhatsApp integration pages. The manual
// connect path is untouched; this only adds a guided alternative.
import { serverEnv } from "@/lib/server-env";

export const GRAPH = "https://graph.facebook.com/v19.0";

export const MESSENGER_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "business_management",
];

export const WHATSAPP_OAUTH_SCOPES = [
  "whatsapp_business_management",
  "whatsapp_business_messaging",
  "business_management",
];

export function metaAppCreds(): { appId: string; appSecret: string } | null {
  const appId = serverEnv("META_APP_ID");
  const appSecret = serverEnv("META_APP_SECRET");
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export function oauthRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/public/meta/oauth-callback`;
}

export function buildAuthorizeUrl(opts: {
  appId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  const p = new URLSearchParams({
    client_id: opts.appId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    response_type: "code",
    scope: opts.scopes.join(","),
    auth_type: "rerequest",
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${p.toString()}`;
}

async function graphJson(url: string): Promise<any> {
  const r = await fetch(url);
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Facebook request failed (${r.status})`);
  return j;
}

/** Swap the OAuth code for a user token, then upgrade it to a long-lived one. */
export async function exchangeCodeForUserToken(opts: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<string> {
  const short = await graphJson(
    `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(opts.appId)}&client_secret=${encodeURIComponent(
      opts.appSecret,
    )}&redirect_uri=${encodeURIComponent(opts.redirectUri)}&code=${encodeURIComponent(opts.code)}`,
  );
  const token = String(short?.access_token ?? "");
  if (!token) throw new Error("Facebook did not return an access token");
  try {
    const long = await graphJson(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
        opts.appId,
      )}&client_secret=${encodeURIComponent(opts.appSecret)}&fb_exchange_token=${encodeURIComponent(token)}`,
    );
    return String(long?.access_token ?? token);
  } catch {
    return token;
  }
}

export type MetaPage = {
  id: string;
  name: string;
  category: string | null;
  picture: string | null;
  access_token: string;
  tasks: string[];
};

/** Pages the authorising user administers, with their per-page tokens. */
export async function listUserPages(userToken: string): Promise<MetaPage[]> {
  const out: MetaPage[] = [];
  let url = `${GRAPH}/me/accounts?fields=id,name,category,access_token,tasks,picture.type(large)&limit=100&access_token=${encodeURIComponent(
    userToken,
  )}`;
  for (let i = 0; i < 5 && url; i++) {
    const j = await graphJson(url);
    for (const p of j?.data ?? []) {
      out.push({
        id: String(p.id),
        name: String(p.name ?? ""),
        category: p.category ?? null,
        picture: p?.picture?.data?.url ?? null,
        access_token: String(p.access_token ?? ""),
        tasks: Array.isArray(p.tasks) ? p.tasks.map(String) : [],
      });
    }
    url = j?.paging?.next ?? "";
  }
  return out;
}

export type MetaWabaNumber = {
  waba_id: string;
  waba_name: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string | null;
  quality_rating: string | null;
};

/** WhatsApp Business Accounts (and their numbers) the user can manage. */
export async function listWhatsappNumbers(userToken: string): Promise<MetaWabaNumber[]> {
  const wabas: { id: string; name: string }[] = [];
  const seen = new Set<string>();

  const pushWabas = (rows: any[]) => {
    for (const w of rows ?? []) {
      const id = String(w?.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      wabas.push({ id, name: String(w?.name ?? w?.id ?? "") });
    }
  };

  // Direct client WABAs granted to this app.
  try {
    const direct = await graphJson(
      `${GRAPH}/me/businesses?fields=id,name&limit=50&access_token=${encodeURIComponent(userToken)}`,
    );
    for (const biz of direct?.data ?? []) {
      for (const edge of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
        try {
          const r = await graphJson(
            `${GRAPH}/${encodeURIComponent(String(biz.id))}/${edge}?fields=id,name&limit=50&access_token=${encodeURIComponent(
              userToken,
            )}`,
          );
          pushWabas(r?.data ?? []);
        } catch {
          // A business without WhatsApp assets simply has nothing here.
        }
      }
    }
  } catch {
    // business_management may not be granted; the shared-WABA path below still works.
  }

  if (wabas.length === 0) {
    try {
      const shared = await graphJson(
        `${GRAPH}/me?fields=assigned_whatsapp_business_accounts{id,name}&access_token=${encodeURIComponent(userToken)}`,
      );
      pushWabas(shared?.assigned_whatsapp_business_accounts?.data ?? []);
    } catch {
      // ignore
    }
  }

  const out: MetaWabaNumber[] = [];
  for (const w of wabas) {
    try {
      const r = await graphJson(
        `${GRAPH}/${encodeURIComponent(w.id)}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=50&access_token=${encodeURIComponent(
          userToken,
        )}`,
      );
      for (const n of r?.data ?? []) {
        out.push({
          waba_id: w.id,
          waba_name: w.name,
          phone_number_id: String(n.id),
          display_phone_number: String(n.display_phone_number ?? ""),
          verified_name: n.verified_name ?? null,
          quality_rating: n.quality_rating ?? null,
        });
      }
    } catch {
      // Skip WABAs this token cannot read numbers for.
    }
  }
  return out;
}
