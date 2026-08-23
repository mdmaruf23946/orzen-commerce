// ElevenLabs post-call webhook: writes call status, duration, transcript and
// the conversation result back onto the store's call log and order.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/ai-calls/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { readCreds, verifyElevenLabsSignature } = await import("@/lib/ai-call-center.server");

        const { data: cfg } = await supabaseAdmin
          .from("ai_call_config")
          .select("elevenlabs_credentials")
          .eq("id", "global")
          .maybeSingle();
        const creds = readCreds<any>((cfg as any)?.elevenlabs_credentials);
        const secret = creds?.webhook_secret;
        if (!secret) return new Response("Not configured", { status: 401 });

        const sig =
          request.headers.get("elevenlabs-signature") ?? request.headers.get("x-elevenlabs-signature");
        if (!verifyElevenLabsSignature(secret, raw, sig)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const d = payload?.data ?? payload;
        const conversationId: string | undefined = d?.conversation_id;
        if (!conversationId) return new Response("ok");

        const { data: call } = await supabaseAdmin
          .from("ai_calls")
          .select("id,store_id,order_id")
          .eq("conversation_id", conversationId)
          .maybeSingle();
        if (!call) return new Response("ok");

        const durationSec = Number(d?.metadata?.call_duration_secs ?? 0);
        const cost = Number(d?.metadata?.cost ?? 0) / 100;
        const summary: string | null = d?.analysis?.transcript_summary ?? null;
        const callSuccessful: string | undefined = d?.analysis?.call_successful;
        const criteria = d?.analysis?.evaluation_criteria_results ?? {};

        function pick(): string {
          const val = (k: string) => String(criteria?.[k]?.result ?? "").toLowerCase();
          if (val("order_confirmed") === "success") return "confirmed";
          if (val("order_cancelled") === "success") return "cancelled";
          if (val("callback_requested") === "success") return "callback";
          if (val("wrong_number") === "success") return "wrong_number";
          const text = `${summary ?? ""}`.toLowerCase();
          if (text.includes("cancel")) return "cancelled";
          if (text.includes("confirm")) return "confirmed";
          if (durationSec < 5) return "no_answer";
          return callSuccessful === "failure" ? "failed" : "info_only";
        }

        const result = pick();
        const status = durationSec > 0 ? "completed" : "no_answer";

        await supabaseAdmin
          .from("ai_calls")
          .update({
            status,
            result,
            duration_sec: Math.round(durationSec),
            cost,
            summary,
            recording_url: d?.metadata?.recording_url ?? null,
            ended_at: new Date().toISOString(),
          } as never)
          .eq("id", (call as any).id);

        const turns: any[] = Array.isArray(d?.transcript) ? d.transcript : [];
        if (turns.length) {
          await supabaseAdmin.from("ai_call_transcripts").insert(
            turns.slice(0, 200).map((t, i) => ({
              call_id: (call as any).id,
              store_id: (call as any).store_id,
              role: t.role === "agent" ? "agent" : "customer",
              message: String(t.message ?? "").slice(0, 4000),
              seq: i,
            })) as never,
          );
        }

        // Apply the outcome to the order when the AI reached a decision.
        const orderId = (call as any).order_id;
        if (orderId && (result === "confirmed" || result === "cancelled")) {
          await supabaseAdmin
            .from("orders")
            .update({ status: result === "confirmed" ? "confirmed" : "cancelled" } as never)
            .eq("id", orderId)
            .eq("store_id", (call as any).store_id);
          await supabaseAdmin
            .from("ai_call_queue")
            .update({ status: "done" } as never)
            .eq("order_id", orderId)
            .in("status", ["pending", "called"]);
        } else if (orderId && (result === "no_answer" || result === "failed")) {
          const { data: cfg2 } = await supabaseAdmin
            .from("ai_call_config")
            .select("rules")
            .eq("id", "global")
            .maybeSingle();
          const rules: any = (cfg2 as any)?.rules ?? {};
          const { data: item } = await supabaseAdmin
            .from("ai_call_queue")
            .select("id,attempts")
            .eq("order_id", orderId)
            .eq("status", "called")
            .maybeSingle();
          if (item) {
            const attempts = Number((item as any).attempts ?? 1);
            const done = attempts >= Number(rules.retry_count ?? 2) + 1;
            await supabaseAdmin
              .from("ai_call_queue")
              .update({
                status: done ? "exhausted" : "pending",
                run_after: new Date(
                  Date.now() + Number(rules.retry_interval_minutes ?? 30) * 60_000,
                ).toISOString(),
              } as never)
              .eq("id", (item as any).id);
          }
        }

        return new Response("ok");
      },
    },
  },
});
