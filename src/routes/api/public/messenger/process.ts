import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const inputSchema = z.object({
  job_id: z.string().uuid(),
  wake_token: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/messenger/process")({
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
        const { data: claimed, error } = await supabaseAdmin.rpc("claim_messenger_job", {
          _job_id: input.job_id,
          _wake_token: input.wake_token,
        });
        if (error) return new Response("Claim failed", { status: 500 });
        if (!claimed) return new Response("No due job", { status: 202 });

        const job = claimed as any;
        const payload = (job.event_payload ?? {}) as {
          raw?: string;
          signature?: string;
          message_id?: string;
        };
        if (!payload.raw || !payload.signature || !payload.message_id) {
          await supabaseAdmin
            .from("messenger_jobs")
            .update({ status: "failed", completed_at: new Date().toISOString(), last_error: "Invalid queued event" } as any)
            .eq("id", job.id);
          return new Response("Invalid job", { status: 422 });
        }

        const started = Date.now();
        try {
          const target = new URL("/api/public/messenger/webhook", request.url);
          const response = await fetch(target, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-hub-signature-256": payload.signature,
              "x-orzen-queue-job": String(job.id),
              "x-orzen-queue-token": String(job.wake_token),
              "x-orzen-queue-mid": payload.message_id,
            },
            body: payload.raw,
          });
          if (!response.ok) throw new Error(`Processor returned ${response.status}`);
          await supabaseAdmin
            .from("messenger_jobs")
            .update({
              status: "sent",
              completed_at: new Date().toISOString(),
              processing_ms: Date.now() - started,
              last_error: null,
            } as any)
            .eq("id", job.id)
            .eq("status", "processing");
          return new Response("ok");
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Messenger processing failed";
          const attempts = Number(job.attempts ?? 1);
          const exhausted = attempts >= 5;
          const backoffSeconds = [5, 15, 45, 120, 300][Math.min(attempts - 1, 4)];
          await supabaseAdmin
            .from("messenger_jobs")
            .update({
              status: exhausted ? "failed" : "retry",
              available_at: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
              completed_at: exhausted ? new Date().toISOString() : null,
              processing_ms: Date.now() - started,
              last_error: message.slice(0, 500),
            } as any)
            .eq("id", job.id);
          if (exhausted) {
            const target = new URL("/api/public/messenger/webhook", request.url);
            await fetch(target, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-hub-signature-256": payload.signature,
                "x-orzen-queue-job": String(job.id),
                "x-orzen-queue-token": String(job.wake_token),
                "x-orzen-queue-mid": payload.message_id,
                "x-orzen-queue-fallback": "1",
              },
              body: payload.raw,
            }).catch(() => undefined);
          }
          return new Response(exhausted ? "Failed" : "Retry scheduled", { status: exhausted ? 422 : 503 });
        }
      },
    },
  },
});