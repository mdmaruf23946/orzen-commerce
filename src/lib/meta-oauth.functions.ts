// "Auto Connect" server functions for the existing Messenger and WhatsApp
// integration pages. Manual connect keeps working exactly as before; these
// functions only add a guided Facebook-Login path that ends in the very same
// integration rows, webhooks and messaging infrastructure.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPlan } from "@/lib/plan-guard";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const isNewKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input as any, { ...init, headers });
      },
    },
  });
}

function publicOrigin(): string {
  try {
    const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    const proto = getRequestHeader("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  } catch {}
  const explicit = process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://orzen.top";
}

async function ownedStoreId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("stores").select("id").eq("owner_user_id", userId).maybeSingle();
  if (!data) throw new Error("Store not found");
  return data.id as string;
}

/** Loads an authorised OAuth session that belongs to this store, or throws. */
async function loadSession(storeId: string, channel: string, sessionId: string) {
  const sb = adminClient();
  const { data } = await sb
    .from("meta_oauth_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("store_id", storeId)
    .eq("channel", channel)
    .maybeSingle();
  const row = data as any;
  if (!row) throw new Error("This connection request was not found. Start Auto Connect again.");
  if (new Date(row.expires_at).getTime() < Date.now())
    throw new Error("This connection request expired. Start Auto Connect again.");
  if (row.status === "error") throw new Error(row.error || "Facebook authorisation failed.");
  if (row.status !== "authorized" || !row.access_token_encrypted)
    throw new Error("Facebook authorisation is not complete yet.");
  const { decryptJSON } = await import("@/lib/crypto/credentials.server");
  return { row, token: decryptJSON<string>(row.access_token_encrypted) };
}

// ---------- Step 1: start the Facebook Login flow ----------
export const startMetaAutoConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channel: z.enum(["messenger", "whatsapp"]) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertPlan(context.supabase, context.userId, data.channel === "messenger" ? "ai_messenger" : "ai_messenger");
    const storeId = await ownedStoreId(context.supabase, context.userId);
    const {
      metaAppCreds,
      oauthRedirectUri,
      buildAuthorizeUrl,
      MESSENGER_OAUTH_SCOPES,
      WHATSAPP_OAUTH_SCOPES,
    } = await import("@/lib/meta-oauth.server");
    const creds = metaAppCreds();
    if (!creds)
      throw new Error(
        "Auto Connect is not available yet because the platform Facebook app is not configured. Use Manual Connect, or ask the platform owner to finish the Facebook app setup.",
      );

    const { randomBytes } = await import("node:crypto");
    const state = randomBytes(24).toString("hex");
    const sb = adminClient();
    // One live request per store/channel keeps the table tidy.
    await sb.from("meta_oauth_sessions").delete().eq("store_id", storeId).eq("channel", data.channel);
    const { data: inserted, error } = await sb
      .from("meta_oauth_sessions")
      .insert({ store_id: storeId, channel: data.channel, state, status: "pending" } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const redirectUri = oauthRedirectUri(publicOrigin());
    return {
      session_id: (inserted as any).id as string,
      redirect_uri: redirectUri,
      authorize_url: buildAuthorizeUrl({
        appId: creds.appId,
        redirectUri,
        state,
        scopes: data.channel === "messenger" ? MESSENGER_OAUTH_SCOPES : WHATSAPP_OAUTH_SCOPES,
      }),
    };
  });

// ---------- Step 2: poll the session / list what was authorised ----------
export const getMetaAutoConnectStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ session_id: z.string().uuid(), channel: z.enum(["messenger", "whatsapp"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const storeId = await ownedStoreId(context.supabase, context.userId);
    const sb = adminClient();
    const { data: row } = await sb
      .from("meta_oauth_sessions")
      .select("status,error,expires_at")
      .eq("id", data.session_id)
      .eq("store_id", storeId)
      .eq("channel", data.channel)
      .maybeSingle();
    if (!row) return { status: "missing" as const, error: null };
    if (new Date((row as any).expires_at).getTime() < Date.now())
      return { status: "expired" as const, error: null };
    return { status: (row as any).status as string, error: (row as any).error as string | null };
  });

export const listMetaAutoConnectPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertPlan(context.supabase, context.userId, "ai_messenger");
    const storeId = await ownedStoreId(context.supabase, context.userId);
    const { token } = await loadSession(storeId, "messenger", data.session_id);
    const { listUserPages } = await import("@/lib/meta-oauth.server");
    const pages = await listUserPages(token);
    return {
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        picture: p.picture,
        can_message: p.tasks.length === 0 || p.tasks.includes("MESSAGING") || p.tasks.includes("MANAGE"),
      })),
    };
  });

export const listMetaAutoConnectNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertPlan(context.supabase, context.userId, "ai_messenger");
    const storeId = await ownedStoreId(context.supabase, context.userId);
    const { token } = await loadSession(storeId, "whatsapp", data.session_id);
    const { listWhatsappNumbers } = await import("@/lib/meta-oauth.server");
    return { numbers: await listWhatsappNumbers(token) };
  });

// ---------- Step 3: finish the connection ----------
export const autoConnectMessengerPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        session_id: z.string().uuid(),
        page_id: z.string().trim().min(2).max(120),
        privacy_policy_url: z.string().trim().max(500).optional().nullable(),
        terms_of_service_url: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertPlan(context.supabase, context.userId, "ai_messenger");
    const storeId = await ownedStoreId(context.supabase, context.userId);
    const { token } = await loadSession(storeId, "messenger", data.session_id);

    const { listUserPages, metaAppCreds, GRAPH } = await import("@/lib/meta-oauth.server");
    const creds = metaAppCreds();
    const pages = await listUserPages(token);
    const page = pages.find((p) => p.id === data.page_id);
    if (!page || !page.access_token)
      throw new Error("That Facebook Page is no longer available on this Facebook account.");

    const { encryptJSON } = await import("@/lib/crypto/credentials.server");
    const { data: existing } = await context.supabase
      .from("messenger_integrations")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    const row = existing as any;

    // Permissions + expiry straight from Meta, same shape as manual connect.
    let permissions: string[] = row?.permissions ?? [];
    let expiresAt: string | null = null;
    if (creds) {
      try {
        const r = await fetch(
          `${GRAPH}/debug_token?input_token=${encodeURIComponent(page.access_token)}&access_token=${encodeURIComponent(
            `${creds.appId}|${creds.appSecret}`,
          )}`,
        );
        const j: any = await r.json();
        const info = j?.data;
        if (info) {
          if (Array.isArray(info.scopes)) permissions = info.scopes;
          const exp = info.expires_at || info.data_access_expires_at;
          if (exp && Number(exp) > 0) expiresAt = new Date(Number(exp) * 1000).toISOString();
        }
      } catch {}
    }

    const { randomBytes } = await import("node:crypto");
    const verify_token = row?.verify_token || `vt_${randomBytes(24).toString("hex")}`;
    const privacy =
      data.privacy_policy_url?.trim() || row?.privacy_policy_url || `${publicOrigin()}/privacy-policy`;
    const terms = data.terms_of_service_url?.trim() || row?.terms_of_service_url || `${publicOrigin()}/terms`;

    const upsertRow: any = {
      store_id: storeId,
      page_id: page.id,
      page_access_token: null,
      page_access_token_encrypted: encryptJSON(page.access_token),
      app_id: creds?.appId ?? row?.app_id ?? null,
      app_secret_encrypted: creds ? encryptJSON(creds.appSecret) : row?.app_secret_encrypted ?? null,
      verify_token,
      page_name: page.name,
      page_picture_url: `${GRAPH}/${encodeURIComponent(page.id)}/picture?type=large`,
      permissions,
      token_expires_at: expiresAt,
      status: "connected",
      connected_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      last_error: null,
      privacy_policy_url: privacy,
      terms_of_service_url: terms,
    };

    const { ensurePageSubscribed } = await import("@/lib/messenger-subscribe.server");
    const sub = await ensurePageSubscribed(page.id, page.access_token);
    if (!sub.ok)
      upsertRow.last_error =
        sub.error ??
        "Facebook Page is connected but message delivery could not be enabled. Re-run Auto Connect and allow messaging.";

    const { error } = await context.supabase
      .from("messenger_integrations")
      .upsert(upsertRow, { onConflict: "store_id" });
    if (error) throw new Error(error.message);

    // Same Page powers posts & comments — mirror it like manual connect does.
    let facebook: any = null;
    try {
      await assertPlan(context.supabase, context.userId, "facebook_page");
      const { syncFacebookPageFromMessenger } = await import("@/lib/facebook-page.server");
      facebook = await syncFacebookPageFromMessenger(context.supabase, storeId, {
        page_id: page.id,
        token: page.access_token,
        app_id: creds?.appId ?? null,
        app_secret: creds?.appSecret ?? null,
      });
    } catch {
      facebook = null;
    }

    const sb = adminClient();
    await sb
      .from("meta_oauth_sessions")
      .update({ status: "used", access_token_encrypted: null } as any)
      .eq("id", data.session_id);

    return { ok: true, page_name: page.name, subscribed: sub.ok, facebook };
  });

export const autoConnectWhatsappNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        session_id: z.string().uuid(),
        phone_number_id: z.string().trim().min(4).max(64),
        waba_id: z.string().trim().max(64).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertPlan(context.supabase, context.userId, "ai_messenger");
    const storeId = await ownedStoreId(context.supabase, context.userId);
    const { token } = await loadSession(storeId, "whatsapp", data.session_id);

    const { data: clash } = await context.supabase
      .from("whatsapp_integrations")
      .select("store_id")
      .eq("phone_number_id", data.phone_number_id)
      .neq("store_id", storeId)
      .maybeSingle();
    if (clash) throw new Error("This WhatsApp number is already connected to another store");

    const { data: existing } = await context.supabase
      .from("whatsapp_integrations")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    const row = existing as any;

    const { encryptJSON } = await import("@/lib/crypto/credentials.server");
    const { metaAppCreds } = await import("@/lib/meta-oauth.server");
    const creds = metaAppCreds();
    const { randomBytes } = await import("node:crypto");

    const patch: Record<string, any> = {
      store_id: storeId,
      phone_number_id: data.phone_number_id,
      waba_id: data.waba_id || row?.waba_id || null,
      verify_token: row?.verify_token || `vt_${randomBytes(24).toString("hex")}`,
      access_token_encrypted: encryptJSON(token),
      status: "connecting",
      last_error: null,
    };
    if (creds) patch["app_secret_encrypted"] = encryptJSON(creds.appSecret);

    const { getWaPhoneNumber, friendlyWaError } = await import("@/lib/whatsapp-send.server");
    try {
      const info = await getWaPhoneNumber(data.phone_number_id, token);
      patch["phone_number"] = info.display_phone_number ?? null;
      patch["display_name"] = info.verified_name ?? null;
      patch["quality_rating"] = info.quality_rating ?? null;
      patch["status"] = "connected";
      patch["connected_at"] = new Date().toISOString();
      patch["last_verified_at"] = new Date().toISOString();
      patch["delivery_failures"] = 0;
    } catch (e) {
      patch["status"] = "error";
      patch["last_error"] = friendlyWaError((e as Error).message);
    }

    const { error } = await context.supabase
      .from("whatsapp_integrations")
      .upsert(patch, { onConflict: "store_id" });
    if (error) throw new Error(error.message);

    const sb = adminClient();
    await sb
      .from("meta_oauth_sessions")
      .update({ status: "used", access_token_encrypted: null } as any)
      .eq("id", data.session_id);

    if (patch["status"] === "error") throw new Error(patch["last_error"]);
    return { ok: true, phone_number: patch["phone_number"] ?? null };
  });
