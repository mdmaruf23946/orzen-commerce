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
      .select("status,page_id,page_name,verify_token,instagram_account_id,instagram_username,instagram_picture_url,instagram_connected_at")
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
      verifyToken: (r.verify_token as string | null) ?? null,
    };
  });

export const connectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { instagram_account_id: string }) => {
    const id = String(input?.instagram_account_id ?? "").trim();
    if (!/^\d{5,30}$/.test(id)) throw new Error("সঠিক Instagram Business Account ID দিন (শুধু সংখ্যা)।");
    return { instagram_account_id: id };
  })
  .handler(async ({ context, data }) => {
    const storeId = await storeIdFor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: integ } = await supabaseAdmin
      .from("messenger_integrations")
      .select("id,page_id,page_access_token,page_access_token_encrypted")
      .eq("store_id", storeId)
      .maybeSingle();
    const i: any = integ;
    if (!i?.page_id) {
      return { ok: false, error: "আগে Messenger-এ আপনার Facebook Page manual connect করুন, তারপর Instagram connect করুন।" };
    }
    const token = (await decrypt(i.page_access_token_encrypted)) || i.page_access_token;
    if (!token) return { ok: false, error: "Facebook Page-এর token পাওয়া যায়নি। Messenger আবার connect করুন।" };

    const igId = data.instagram_account_id;
    const r = await fetch(
      `${GRAPH}/${encodeURIComponent(igId)}?fields=id,username,profile_picture_url&access_token=${encodeURIComponent(token)}`,
    );
    const ig: any = await r.json().catch(() => ({}));
    if (!r.ok || !ig?.id) {
      console.warn("[instagram] manual verify failed", ig?.error?.message);
      return {
        ok: false,
        error:
          "এই Instagram ID যাচাই করা যায়নি। ID সঠিক কিনা, Instagram account Page-এর সাথে link করা কিনা এবং Page token-এ instagram_basic ও instagram_manage_messages অনুমতি আছে কিনা দেখুন।",
      };
    }

    const { data: other } = await supabaseAdmin
      .from("messenger_integrations")
      .select("store_id")
      .eq("instagram_account_id", String(ig.id))
      .neq("store_id", storeId)
      .maybeSingle();
    if (other) return { ok: false, error: "এই Instagram account অন্য একটি স্টোরে যুক্ত আছে।" };

    await supabaseAdmin
      .from("messenger_integrations")
      .update({
        instagram_account_id: String(ig.id),
        instagram_username: ig.username ?? null,
        instagram_picture_url: ig.profile_picture_url ?? null,
        instagram_connected_at: new Date().toISOString(),
      } as any)
      .eq("id", i.id);

    return { ok: true, username: (ig.username as string | null) ?? null };
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
