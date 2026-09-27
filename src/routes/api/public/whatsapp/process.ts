import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { processWhatsAppJob, sendWhatsAppFallback, type WaJobRow } from "@/lib/whatsapp-webhook.server";

const inputSchema = z.object({ job_id: z.string().uuid(), wake_token: z.string().uuid() });
const BACKOFF = [5, 15, 45, 120, 300];

// Queue worker: woken by a database trigger on insert and a one-minute
// recovery sweep. The unguessable wake_token authorises the call.
export const Route = createFileRoute("/api/public/whatsapp/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let input: z.infer<typeof inputSchema>;
        try {
          input = inputSchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb = supabaseAdmin as any;
        const claim = await sb.rpc("claim_whatsapp_job", { _job_id: input.job_id, _wake_token: input.wake_token });
        if (claim.error) return new Response("Claim failed", { status: 500 });
        let job = claim.data as WaJobRow | null;
        if (!job) return new Response("No due job", { status: 202 });

        for (let drained = 0; drained < 10 && job; drained += 1) {
          const started = Date.now();
          try {
            const res: { reply: string | null; skipped?: string } = job.reply_text
              ? { reply: job.reply_text }
              : await processWhatsAppJob(job);
            await sb
              .from("whatsapp_jobs")
              .update({
                status: res.skipped ? "skipped" : "sent",
                completed_at: new Date().toISOString(),
                processing_ms: Date.now() - started,
                last_error: res.skipped ?? null,
                reply_text: res.reply,
              })
              .eq("id", job.id);
          } catch (cause) {
            const message = cause instanceof Error ? cause.message : "WhatsApp processing failed";
            const attempts = Number(job.attempts ?? 1);
            const exhausted = attempts >= 5;
            await sb
              .from("whatsapp_jobs")
              .update({
                status: exhausted ? "failed" : "retry",
                available_at: new Date(Date.now() + (BACKOFF[Math.min(attempts - 1, 4)] ?? 300) * 1000).toISOString(),
                completed_at: exhausted ? new Date().toISOString() : null,
                processing_ms: Date.now() - started,
                last_error: message.slice(0, 500),
              })
              .eq("id", job.id);
            if (exhausted) await sendWhatsAppFallback(job).catch(() => undefined);
            return new Response(exhausted ? "Failed" : "Retry scheduled", { status: exhausted ? 422 : 503 });
          }

          const { data: next }: { data: { id: string; wake_token: string } | null } = await sb
            .from("whatsapp_jobs")
            .select("id,wake_token")
            .eq("store_id", job.store_id)
            .eq("sender_id", job.sender_id)
            .in("status", ["pending", "retry"])
            .lte("available_at", new Date().toISOString())
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (!next) break;
          const nc: { data: unknown } = await sb.rpc("claim_whatsapp_job", { _job_id: next.id, _wake_token: next.wake_token });
          job = (nc.data as WaJobRow | null) ?? null;
        }
        return new Response("ok");
      },
    },
  },
});
