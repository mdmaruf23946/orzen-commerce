// Facebook Login redirect target for the "Auto Connect" option on the
// Messenger and WhatsApp integration pages. Facebook calls this URL with a
// one-time code; we swap it for a token, stash it against the pending session
// and bounce the merchant back to the page they started from.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function adminClient() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const isNewKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
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

function back(origin: string, channel: string, params: Record<string, string>) {
  const page = channel === "whatsapp" ? "/admin/whatsapp" : "/admin/messenger";
  const q = new URLSearchParams(params).toString();
  return new Response(null, { status: 302, headers: { Location: `${origin}${page}?${q}` } });
}

export const Route = createFileRoute("/api/public/meta/oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        const denied = url.searchParams.get("error_description") || url.searchParams.get("error");

        if (!state) return new Response("Missing state", { status: 400 });

        const sb = adminClient();
        const { data } = await sb
          .from("meta_oauth_sessions")
          .select("id,channel,status,expires_at")
          .eq("state", state)
          .maybeSingle();
        const row = data as any;
        if (!row) return new Response("Unknown or expired request", { status: 400 });

        const fail = async (msg: string) => {
          await sb
            .from("meta_oauth_sessions")
            .update({ status: "error", error: msg.slice(0, 400) } as any)
            .eq("id", row.id);
          return back(origin, row.channel, { meta_session: row.id, meta_result: "error" });
        };

        if (new Date(row.expires_at).getTime() < Date.now()) return await fail("This request expired.");
        if (denied || !code) return await fail(denied || "Facebook authorisation was cancelled.");

        try {
          const { metaAppCreds, oauthRedirectUri, exchangeCodeForUserToken } = await import(
            "@/lib/meta-oauth.server"
          );
          const creds = await metaAppCreds();
          if (!creds) return await fail("The platform Facebook app is not configured.");
          const token = await exchangeCodeForUserToken({
            appId: creds.appId,
            appSecret: creds.appSecret,
            redirectUri: oauthRedirectUri(origin),
            code,
          });
          const { encryptJSON } = await import("@/lib/crypto/credentials.server");
          await sb
            .from("meta_oauth_sessions")
            .update({ status: "authorized", error: null, access_token_encrypted: encryptJSON(token) } as any)
            .eq("id", row.id);
          return back(origin, row.channel, { meta_session: row.id, meta_result: "ok" });
        } catch (e) {
          return await fail((e as Error).message);
        }
      },
    },
  },
});
