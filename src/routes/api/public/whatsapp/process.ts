import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { processWhatsAppJob, sendWhatsAppFallback, type WaJobRow } from "@/lib/whatsapp-webhook.server";

const inputSchema = z.object({ job_id: z.string().uuid(), wake_token: z.string().uuid() });
const BACKOFF = [5, 15, 45, 120, 300];
const QUIET_MS = 1500; // wait until the customer stops typing for this long
const MAX_BURST_WAIT_MS = 6000; // never hold a reply longer than this for merging

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isPlainText = (j: { event_payload?: any }) => (j.event_payload?.type ?? "text") === "text" && !j.event_payload?.button_payload;

async function claim(sb: any, id: string, token: string): Promise<WaJobRow | null> {
  const r = await sb.rpc("claim_whatsapp_job", { _job_id: id, _wake_token: token });
  return (r.data as WaJobRow | null) ?? null;
}

/** Claim, waiting (bounded) for the debounce window if the job isn't due yet. */
async function claimWhenDue(sb: any, id: string, token: string): Promise<WaJobRow | null> {
  const job = await claim(sb, id, token);
  if (job) return job;
  const { data: row } = await sb.from("whatsapp_jobs").select("status,available_at").eq("id", id).maybeSingle();
  const waitMs = row && ["pending", "retry"].includes(row.status) ? new Date(row.available_at).getTime() - Date.now() : -1;
  if (waitMs <= 0 || waitMs > 45_000) return null;
  await sleep(waitMs + 200);
  return claim(sb, id, token);
}

/**
 * Debounce: while newer plain-text messages from the same customer keep
 * arriving, fold the current job into the newest one. Every message is
 * already in the conversation history, so the final job's single AI reply
 * reads the whole burst.
 */
async function foldBurst(sb: any, job: WaJobRow): Promise<WaJobRow> {
  if (job.reply_text || !isPlainText(job)) return job;
  const deadline = Date.now() + MAX_BURST_WAIT_MS;
  let current = job;
  for (;;) {
    const { data: newer } = await sb
      .from("whatsapp_jobs")
      .select("id,wake_token,created_at,event_payload")
      .eq("store_id", current.store_id)
      .eq("sender_id", current.sender_id)
      .in("status", ["pending", "retry"])
      .gt("created_at", (current as any).created_at)
      .order("created_at", { ascending: false })
      .limit(5);
    const rows = (newer ?? []) as any[];
    if (rows.length && rows.every(isPlainText)) {
      const newest = rows[0];
      const others = rows.slice(1).map((r) => r.id);
      await sb.from("whatsapp_jobs")
        .update({ status: "merged", merged_into: newest.id, completed_at: new Date().toISOString() })
        .in("id", [current.id, ...others]);
      // Make the newest due now and take it over.
      await sb.from("whatsapp_jobs").update({ available_at: new Date().toISOString() }).eq("id", newest.id);
      const next = await claim(sb, newest.id, newest.wake_token);
      if (!next) return current; // someone else took it; they will reply
      current = next;
      continue;
    }
    if (rows.length) return current; // a button/media follows — answer in order
    const age = Date.now() - new Date((current as any).created_at).getTime();
    if (age >= QUIET_MS || Date.now() >= deadline) return current;
    await sleep(Math.min(QUIET_MS - age + 100, deadline - Date.now()));
  }
}

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
        let job = await claimWhenDue(sb, input.job_id, input.wake_token);
        if (!job) return new Response("No due job", { status: 202 });

        for (let drained = 0; drained < 10 && job; drained += 1) {
          job = await foldBurst(sb, job);
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
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          // Hand the next message to a fresh worker (own request budget)
          // instead of draining here, which ran out of budget on long bursts.
          if (next) await sb.rpc("kick_whatsapp_job", { _job_id: next.id });
          break;
        }
        return new Response("ok");
      },
    },
  },
});
