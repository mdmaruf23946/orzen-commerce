// Instagram Direct messaging. Instagram rides on the store's connected Facebook
// Page (same token, webhook, AI pipeline and Omni Inbox); this module only links
// the Page's Instagram business account and subscribes the app to its messages.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { myStoreRow } from "@/lib/store-access";

const GRAPH = "https://graph.facebook.com/v19.0";

async function storeIdFor(supabase: any, userId: string) {
  const row = await myStoreRow(supabase, userId, "id", "messenger");
  if (!row) throw new Error("Store not found");
  return row.id as string;
}

async function decrypt(enc: string | null | undefined): Promise<string | null> {
  if (!enc) return null;
  try {
    const mod = await import("@/lib/crypto/credentials.server");
    return mod.decryptJSON<string>(enc);
  } catch {
    return null;
  }
}

export const getInstagramIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("messenger_integrations")
      .select("status,page_id,page_name,instagram_account_id,instagram_username,instagram_picture_url,instagram_connected_at")
      .eq("store_id", storeId)
      .maybeSingle();
    const r: any = data ?? {};
    return {
      pageConnected: !!r.page_id && r.status === "connected",
      pageName: (r.page_name as string | null) ?? null,
      connected: !!r.instagram_account_id,
      username: (r.instagram_username as string | null) ?? null,
      picture: (r.instagram_picture_url as string | null) ?? null,
      connectedAt: (r.instagram_connected_at as string | null) ?? null,
    };
  });

export const connectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: integ } = await supabaseAdmin
      .from("messenger_integrations")
      .select("id,page_id,status,page_access_token,page_access_token_encrypted,app_id,app_secret_encrypted,verify_token")
      .eq("store_id", storeId)
      .maybeSingle();
    const i: any = integ;
    if (!i?.page_id) {
      return { ok: false, error: "আগে Messenger-এ আপনার Facebook Page connect করুন, তারপর Instagram connect করুন।" };
    }
    const token = (await decrypt(i.page_access_token_encrypted)) || i.page_access_token;
    if (!token) return { ok: false, error: "Facebook Page-এর token পাওয়া যায়নি। Messenger আবার connect করুন।" };

    const r = await fetch(
      `${GRAPH}/${encodeURIComponent(i.page_id)}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(token)}`,
    );
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.warn("[instagram] lookup failed", j?.error?.message);
      return {
        ok: false,
        error:
          "Instagram পড়ার অনুমতি নেই। Messenger পেজে গিয়ে Auto Connect দিয়ে আবার Facebook login করুন এবং Instagram-এর সব অনুমতি দিন।",
      };
    }
    const ig = j?.instagram_business_account;
    if (!ig?.id) {
      return {
        ok: false,
        error:
          "এই Facebook Page-এর সাথে কোনো Instagram Business/Creator account যুক্ত নেই। Instagram-কে Professional account করে Page-এর সাথে link করুন।",
      };
    }

    // Same id already linked to another store? Never share one inbox across stores.
    const { data: other } = await supabaseAdmin
      .from("messenger_integrations")
      .select("store_id")
      .eq("instagram_account_id", String(ig.id))
      .neq("store_id", storeId)
      .maybeSingle();
    if (other) return { ok: false, error: "এই Instagram account অন্য একটি স্টোরে যুক্ত আছে।" };

    // Page must be subscribed (Instagram messages are delivered via the Page app link).
    try {
      const { ensurePageSubscribed } = await import("@/lib/messenger-subscribe.server");
      await ensurePageSubscribed(i.page_id, token);
    } catch {
      /* best effort */
    }

    // App-level webhook subscription for the "instagram" object, reusing the Page callback.
    let webhook: string = "skipped";
    const appSecret = await decrypt(i.app_secret_encrypted);
    if (i.app_id && appSecret && i.verify_token) {
      const appAccess = `${i.app_id}|${appSecret}`;
      try {
        const sr = await fetch(`${GRAPH}/${encodeURIComponent(i.app_id)}/subscriptions?access_token=${encodeURIComponent(appAccess)}`);
        const sj: any = await sr.json().catch(() => ({}));
        const subs: any[] = sj?.data ?? [];
        const pageSub = subs.find((s) => s?.object === "page");
        const igSub = subs.find((s) => s?.object === "instagram");
        const names: string[] = (igSub?.fields ?? []).map((f: any) => String(f?.name ?? f));
        if (igSub && names.includes("messages")) webhook = "ok";
        else if (pageSub?.callback_url) {
          const body = new URLSearchParams({
            object: "instagram",
            callback_url: pageSub.callback_url,
            verify_token: i.verify_token,
            fields: [...new Set([...names, "messages", "messaging_postbacks", "messaging_seen"])].join(","),
            include_values: "true",
            access_token: appAccess,
          });
          const pr = await fetch(`${GRAPH}/${encodeURIComponent(i.app_id)}/subscriptions`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body,
          });
          const pj: any = await pr.json().catch(() => ({}));
          webhook = pr.ok && pj?.success ? "ok" : "failed";
          if (webhook === "failed") console.warn("[instagram] app subscribe failed", pj?.error?.message);
        } else webhook = "no-page-sub";
      } catch (e) {
        console.warn("[instagram] subscribe error", (e as Error).message);
        webhook = "failed";
      }
    }

    await supabaseAdmin
      .from("messenger_integrations")
      .update({
        instagram_account_id: String(ig.id),
        instagram_username: ig.username ?? null,
        instagram_picture_url: ig.profile_picture_url ?? null,
        instagram_connected_at: new Date().toISOString(),
      } as any)
      .eq("id", i.id);

    return { ok: true, username: (ig.username as string | null) ?? null, webhook };
  });

export const disconnectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("messenger_integrations")
      .update({ instagram_account_id: null, instagram_username: null, instagram_picture_url: null, instagram_connected_at: null } as any)
      .eq("store_id", storeId);
    return { ok: true };
  });
