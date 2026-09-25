import { createFileRoute } from "@tanstack/react-router";

function resultPage(message: string, ok: boolean, pageId?: string | null) {
  const destination = pageId ? `https://m.me/${encodeURIComponent(pageId)}` : "https://www.messenger.com/";
  const color = ok ? "#16704a" : "#b42318";
  return new Response(
    `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ORZEN</title></head><body style="font-family:system-ui,sans-serif;margin:0;padding:32px;background:#f7f7f5;color:#171717"><main style="max-width:480px;margin:12vh auto;text-align:center"><h1 style="font-size:22px;color:${color}">${message}</h1><p>অর্ডারের পরের মেসেজটি Messenger-এ পাঠানো হয়েছে।</p><a href="${destination}" style="display:inline-block;margin-top:16px;padding:12px 18px;background:#0866ff;color:white;text-decoration:none;border-radius:8px">Messenger-এ ফিরুন</a></main></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/public/messenger/buy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const tokenParam = new URL(request.url).searchParams.get("token");
        if (!tokenParam) return resultPage("লিংকটি সঠিক নয়", false);

        const { readMessengerBuyLink } = await import("@/lib/messenger-buy-link.server");
        const payload = readMessengerBuyLink(tokenParam);
        if (!payload) return resultPage("এই অর্ডার লিংকটির মেয়াদ শেষ হয়েছে", false);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: integration } = await supabaseAdmin
          .from("messenger_integrations")
          .select("id,page_id,page_access_token,page_access_token_encrypted,ai_auto_reply,human_takeover")
          .eq("store_id", payload.storeId)
          .maybeSingle();
        if (!integration || (integration as any).human_takeover || (integration as any).ai_auto_reply === false) {
          return resultPage("অর্ডারটি এখন শুরু করা যাচ্ছে না", false, (integration as any)?.page_id);
        }

        const { data: conversation } = await supabaseAdmin
          .from("ai_conversations")
          .select("id,handoff_mode")
          .eq("store_id", payload.storeId)
          .eq("channel", "messenger")
          .eq("external_id", payload.psid)
          .maybeSingle();
        if (!conversation || (conversation as any).handoff_mode === "human") {
          return resultPage("অর্ডারটি এখন শুরু করা যাচ্ছে না", false, (integration as any).page_id);
        }

        let pageToken = (integration as any).page_access_token as string | null;
        if ((integration as any).page_access_token_encrypted) {
          const { decryptJSON } = await import("@/lib/crypto/credentials.server");
          try {
            pageToken = decryptJSON<string>((integration as any).page_access_token_encrypted);
          } catch {
            pageToken = null;
          }
        }
        if (!pageToken) return resultPage("অর্ডারটি এখন শুরু করা যাচ্ছে না", false, (integration as any).page_id);

        const { handleBuyPostback } = await import("@/lib/messenger-webhook.server");
        const handled = await handleBuyPostback({
          sb: supabaseAdmin as any,
          storeId: payload.storeId,
          conversationId: conversation.id,
          psid: payload.psid,
          token: pageToken,
          payload: `BUY_${payload.productId}`,
        });
        return resultPage(handled ? "অর্ডার শুরু হয়েছে" : "অর্ডারটি শুরু করা যায়নি", handled, (integration as any).page_id);
      },
    },
  },
});