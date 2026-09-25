import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handleMessengerWebhook } from "@/lib/messenger-webhook.server";

const inputSchema = z.object({
  job_id: z.string().uuid(),
  wake_token: z.string().uuid(),
});

type MessengerJob = {
  id: string;
  wake_token: string;
  store_id: string;
  sender_id: string;
  attempts?: number;
  started_at?: string | null;
  reply_text?: string | null;
  outbound_message_id?: string | null;
  event_payload?: unknown;
};

/**
 * Run the queued delivery IN-PROCESS. A self-`fetch` back to our own hostname
 * goes out through Cloudflare and comes back as 522, which silently killed
 * every queued reply — so the webhook logic is called directly instead.
 */
function runQueuedDelivery(
  requestUrl: string,
  payload: { raw: string; signature: string; message_id: string },
  job: { id: string; wake_token: string },
  fallbackOnly = false,
) {
  const target = new URL("/api/public/messenger/webhook", requestUrl);
  const headers = new Headers({
    "content-type": "application/json",
    "x-hub-signature-256": payload.signature,
    "x-orzen-queue-job": String(job.id),
    "x-orzen-queue-token": String(job.wake_token),
    "x-orzen-queue-mid": payload.message_id,
  });
  if (fallbackOnly) headers.set("x-orzen-queue-fallback", "1");
  return handleMessengerWebhook(
    new Request(target, { method: "POST", headers, body: payload.raw }),
  );
}

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

        let claimedJob = claimed as MessengerJob | null;
        if (!claimedJob) {
          // The job may simply be waiting out the merchant's configured reply
          // delay. Wait it out here (bounded) so short delays are honoured
          // exactly instead of falling through to the one-minute recovery cron.
          const { data: pending } = await supabaseAdmin
            .from("messenger_jobs")
            .select("status,available_at")
            .eq("id", input.job_id)
            .maybeSingle();
          const row = pending as any;
          const waitMs =
            row && (row.status === "pending" || row.status === "retry")
              ? new Date(row.available_at).getTime() - Date.now()
              : -1;
          if (waitMs > 0 && waitMs <= 45_000) {
            await new Promise((r) => setTimeout(r, waitMs + 250));
            const retry = await supabaseAdmin.rpc("claim_messenger_job", {
              _job_id: input.job_id,
              _wake_token: input.wake_token,
            });
            claimedJob = retry.data as MessengerJob | null;
          }
          if (!claimedJob) return new Response("No due job", { status: 202 });
        }

        let job = claimedJob as MessengerJob;
        // Drain this sender's due jobs in order. A newer webhook wake may arrive
        // while the older image is still processing; draining here prevents it
        // from waiting for the one-minute recovery sweep.
        for (let drained = 0; drained < 10; drained += 1) {
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
            // A previous attempt can send successfully and then fail while doing
            // bookkeeping. Once recorded, never send that customer reply again.
            if (!job.reply_text && !job.outbound_message_id) {
              const response = await runQueuedDelivery(
                request.url,
                payload as { raw: string; signature: string; message_id: string },
                job,
              );
              if (!response.ok) {
                const detail = (await response.text().catch(() => "")).slice(0, 200);
                throw new Error(`Processor returned ${response.status}${detail ? `: ${detail}` : ""}`);
              }
            }
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
          } catch (cause) {
            // A previous attempt of THIS job can send successfully and then fail
            // while doing bookkeeping. Only treat the job as sent when its own
            // row recorded the reply — never credit another job's outbound
            // message in the same conversation, or this job would be closed
            // without ever delivering anything.
            const { data: ownJob } = await supabaseAdmin
              .from("messenger_jobs")
              .select("reply_text,outbound_message_id")
              .eq("id", job.id)
              .maybeSingle();
            const ownReply = ownJob as { reply_text?: string | null; outbound_message_id?: string | null } | null;
            if (ownReply?.reply_text || ownReply?.outbound_message_id) {
              await supabaseAdmin
                .from("messenger_jobs")
                .update({
                  status: "sent",
                  completed_at: new Date().toISOString(),
                  processing_ms: Date.now() - started,
                  last_error: null,
                } as any)
                .eq("id", job.id);
            } else {
              const message = cause instanceof Error ? cause.message : "Messenger processing failed";
              const attempts = Number(job.attempts ?? 1);
              // The webhook wraps image failures in a 503 response body, so the
              // processor sees "Processor returned 503: IMAGE_TERMINAL_<code>: ..."
              // rather than the bare prefix. Search anywhere in the message.
              const terminalImageFailure = message.includes("IMAGE_TERMINAL_");
              const exhausted = terminalImageFailure || attempts >= 5;
              const backoffSeconds = [5, 15, 45, 120, 300][Math.min(attempts - 1, 4)] ?? 300;
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
                await runQueuedDelivery(request.url, payload as { raw: string; signature: string; message_id: string }, job, true)
                  .catch(() => undefined);
              }
              return new Response(exhausted ? "Failed" : "Retry scheduled", { status: exhausted ? 422 : 503 });
            }
          }

          const { data: next } = await supabaseAdmin
            .from("messenger_jobs")
            .select("id,wake_token")
            .eq("store_id", job.store_id)
            .eq("sender_id", job.sender_id)
            .in("status", ["pending", "retry"])
            .lte("available_at", new Date().toISOString())
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (!next) break;
          const nextClaim = await supabaseAdmin.rpc("claim_messenger_job", {
            _job_id: next.id,
            _wake_token: next.wake_token,
          });
          if (!nextClaim.data) break;
          job = nextClaim.data as MessengerJob;
        }
        return new Response("ok");
      },
    },
  },
});
