// Facebook Page webhook — keeps posts and comments in sync without manual reloads.
// Standalone from the Messenger webhook: it only touches the Facebook Page tables.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import type { Database } from "@/integrations/supabase/types";

function admin() {
  return createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function verifySignature(raw: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(raw).digest("hex");
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function decrypt(value: string | null | undefined) {
  if (!value) return null;
  try {
    const { decryptJSON } = await import("@/lib/crypto/credentials.server");
    return decryptJSON<string>(value);
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/facebook/webhook")({
  server: {
    handlers: {
      // Meta verification handshake — matched against the per-store verify token.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        if (mode !== "subscribe" || !token) return new Response("Bad request", { status: 400 });
        const { data } = await admin()
          .from("facebook_page_integrations")
          .select("id")
          .eq("verify_token", token)
          .maybeSingle();
        if (!data) return new Response("Forbidden", { status: 403 });
        return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-hub-signature-256");
        let body: any;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("ok", { status: 200 });
        }
        if (body?.object !== "page") return new Response("ok", { status: 200 });

        const sb = admin();

        for (const entry of body?.entry ?? []) {
          const pageId = String(entry?.id ?? "");
          if (!pageId) continue;

          const { data: integ } = await sb
            .from("facebook_page_integrations")
            .select("*")
            .eq("page_id", pageId)
            .maybeSingle();
          if (!integ) continue;

          const appSecret = await decrypt((integ as any).app_secret_encrypted);
          if (!appSecret || !verifySignature(raw, signature, appSecret)) {
            return new Response("Invalid signature", { status: 401 });
          }
          if ((integ as any).webhook_enabled === false) continue;

          const storeId = (integ as any).store_id as string;

          for (const change of entry?.changes ?? []) {
            if (change?.field !== "feed") continue;
            const v = change?.value ?? {};
            const item = String(v.item ?? "");
            const verb = String(v.verb ?? "");

            if (item === "comment" && v.comment_id) {
              if (verb === "remove" || verb === "hide") {
                if (verb === "remove") {
                  await sb
                    .from("facebook_comments")
                    .delete()
                    .eq("store_id", storeId)
                    .eq("comment_id", String(v.comment_id));
                } else {
                  await sb
                    .from("facebook_comments")
                    .update({ hidden: true })
                    .eq("store_id", storeId)
                    .eq("comment_id", String(v.comment_id));
                }
              } else if (verb === "unhide") {
                await sb
                  .from("facebook_comments")
                  .update({ hidden: false })
                  .eq("store_id", storeId)
                  .eq("comment_id", String(v.comment_id));
              } else {
                // add / edited — never store the page's own replies as customer comments
                const fromId = v?.from?.id ? String(v.from.id) : null;
                if (fromId === pageId) continue;
                await sb.from("facebook_comments").upsert(
                  {
                    store_id: storeId,
                    comment_id: String(v.comment_id),
                    post_id: v.post_id ? String(v.post_id) : null,
                    post_excerpt: null,
                    author_id: fromId,
                    author_name: v?.from?.name ?? null,
                    message: v.message ?? "",
                    comment_created_at: v.created_time
                      ? new Date(Number(v.created_time) * 1000).toISOString()
                      : new Date().toISOString(),
                    hidden: false,
                  } as any,
                  { onConflict: "store_id,comment_id" },
                );
              }
            }

            if (item === "status" || item === "photo" || item === "video" || item === "post") {
              const postId = v.post_id ? String(v.post_id) : null;
              if (postId && verb === "remove") {
                await sb.from("facebook_posts").delete().eq("store_id", storeId).eq("fb_post_id", postId);
              }
            }
          }

          await sb
            .from("facebook_page_integrations")
            .update({ last_webhook_at: new Date().toISOString() } as any)
            .eq("store_id", storeId);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
