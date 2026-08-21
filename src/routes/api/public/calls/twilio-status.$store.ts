// Twilio call status webhook. Signature-verified per store, writes only the
// call row that matches the provider call SID.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/calls/twilio-status/$store")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const storeId = params.store;
        if (!/^[0-9a-f-]{36}$/i.test(storeId)) return new Response("Bad request", { status: 400 });

        const raw = await request.text();
        const form = new URLSearchParams(raw);
        const fields: Record<string, string> = {};
        form.forEach((v, k) => (fields[k] = v));

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("call_provider_settings")
          .select("credentials_encrypted")
          .eq("store_id", storeId)
          .maybeSingle();
        if (!settings) return new Response("Not found", { status: 404 });

        const { readCreds, verifyTwilioSignature, mapTwilioStatus } = await import("@/lib/call-center.server");
        const creds = readCreds<any>((settings as any).credentials_encrypted);
        if (!creds?.auth_token) return new Response("Not configured", { status: 401 });

        const proto = request.headers.get("x-forwarded-proto") ?? "https";
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
        const url = `${proto}://${host}/api/public/calls/twilio-status/${storeId}`;
        const ok = verifyTwilioSignature(
          creds.auth_token,
          url,
          fields,
          request.headers.get("x-twilio-signature"),
        );
        if (!ok) return new Response("Invalid signature", { status: 401 });

        const sid = fields["CallSid"];
        const callStatus = fields["CallStatus"];
        if (!sid || !callStatus) return new Response("ok");

        const status = mapTwilioStatus(callStatus);
        const patch: Record<string, unknown> = { status };
        const duration = Number(fields["CallDuration"] ?? 0);
        if (duration > 0) patch["duration_sec"] = duration;
        if (!["calling", "ringing", "answered"].includes(status)) patch["ended_at"] = new Date().toISOString();

        await supabaseAdmin
          .from("calls")
          .update(patch as never)
          .eq("store_id", storeId)
          .eq("provider_call_sid", sid);

        return new Response("ok");
      },
    },
  },
});
