// Extracted from the Messenger webhook; preserve existing channel behaviour.
import { traceTime, currentTrace } from "@/lib/telemetry.server";
import { sendViewSiteButton } from "@/lib/integrations/messenger-send.server";
import { sanitizeOutgoingText, type PayloadFacts } from "@/lib/integrations/messenger-text";
import type { MessengerClient } from "@/lib/integrations/messenger-client.server";

/** Load-test jobs (mid "loadtest_…") never reach Meta. */
export function isDryRun() {
  return currentTrace()?.meta.dry_run === true;
}

export async function fbSend(pageToken: string, recipientId: string, text: string) {
  if (isDryRun()) { await new Promise((r) => setTimeout(r, 300)); return { message_id: `dryrun_${crypto.randomUUID()}` }; }
  const r = await traceTime("send", () => fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text },
      }),
    },
  ));
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) throw new Error(j?.error?.message || `Send failed (${r.status})`);
  return j as { message_id?: string };
}

/** Show the Page "typing…" bubble instantly so replies feel immediate. */
export async function fbTyping(pageToken: string, recipientId: string) {
  if (isDryRun()) return;
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, sender_action: "typing_on" }),
  });
}

/** Merchant-controlled pacing: wait only the time still left after the AI worked. */
export async function waitRemainingDelay(startedAt: number, delaySeconds: number) {
  const target = Math.max(0, Math.min(600, Number(delaySeconds) || 0)) * 1000;
  const left = target - (Date.now() - startedAt);
  if (left > 0) await traceTime("delay", () => new Promise((r) => setTimeout(r, left)));
}

export async function fbSendImage(pageToken: string, recipientId: string, imageUrl: string) {
  if (isDryRun()) return { message_id: `dryrun_${crypto.randomUUID()}` };
  const r = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: {
          attachment: {
            type: "image",
            payload: { url: imageUrl, is_reusable: true },
          },
        },
      }),
    },
  );
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) throw new Error(j?.error?.message || `Image send failed (${r.status})`);
  return j as { message_id?: string };
}

/** True when this is a retry and an earlier attempt of the same job already replied. */
export async function alreadyAnsweredOnRetry(sb: MessengerClient, jobId: string, conversationId: string) {
  const { data: job } = await sb
    .from("messenger_jobs")
    .select("attempts,created_at,store_id,sender_id")
    .eq("id", jobId)
    .maybeSingle();
  const j = job as any;
  if (!j || Number(j.attempts ?? 1) <= 1) return false;
  // Replies to the previous message of this customer finish before this job may start.
  const { data: prev } = await sb
    .from("messenger_jobs")
    .select("completed_at")
    .eq("store_id", j.store_id)
    .eq("sender_id", j.sender_id)
    .lt("created_at", j.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const after = [j.created_at, (prev as any)?.completed_at].filter(Boolean).sort().pop();
  const { data: out } = await sb
    .from("ai_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .gt("created_at", after)
    .limit(1);
  return (out ?? []).length > 0;
}

export async function markQueuedReply(
  sb: MessengerClient,
  queuedJobId: string | null,
  text: string,
  outboundMessageId?: string | null,
) {
  if (!queuedJobId) return;
  await sb
    .from("messenger_jobs")
    .update({ reply_text: text.slice(0, 2000), outbound_message_id: outboundMessageId ?? null } as any)
    .eq("id", queuedJobId);
}

export async function logOutgoingText(sb: MessengerClient, conversationId: string, text: string, mid?: string | null, failedError?: string) {
  await sb.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    direction: "out",
    message_type: "text",
    content: text,
    mid: mid ?? null,
    delivery_status: failedError ? "failed" : "sent",
    error: failedError ?? null,
  } as any);
}

export async function sendAndLogText(
  sb: MessengerClient,
  token: string,
  psid: string,
  conversationId: string,
  rawText: string,
  facts: PayloadFacts = {},
) {
  // Never point at a card/image/link that is not part of this payload.
  const text = sanitizeOutgoingText(rawText, facts) || rawText;
  try {
    const sent = await fbSend(token, psid, text);
    await logOutgoingText(sb, conversationId, text, sent.message_id ?? null);
    return true;
  } catch (e) {
    await logOutgoingText(sb, conversationId, text, null, (e as Error).message);
    throw e;
  }
}

export async function sendAndLogViewSiteButton(
  sb: MessengerClient,
  token: string,
  psid: string,
  conversationId: string,
  text: string,
  url: string,
) {
  try {
    const sent = await sendViewSiteButton(token, psid, text, url);
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      direction: "out",
      message_type: "button",
      content: text,
      attachments: [{ type: "web_url", url }],
      mid: sent.message_id ?? null,
      delivery_status: "sent",
    } as any);
    return true;
  } catch (e) {
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      direction: "out",
      message_type: "button",
      content: text,
      attachments: [{ type: "web_url", url }],
      delivery_status: "failed",
      error: (e as Error).message,
    } as any);
    throw e;
  }
}

export type IncomingContent = {
  text: string;
  message_type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "file"
    | "sticker"
    | "quick_reply"
    | "postback";
  attachments: any[];
};

export function parseMessage(msg: any): IncomingContent {
  if (msg?.quick_reply?.payload) {
    return {
      text: msg.text || msg.quick_reply.payload,
      message_type: "quick_reply",
      attachments: [{ type: "quick_reply", payload: msg.quick_reply.payload }],
    };
  }
  if (msg?.text) {
    return { text: msg.text, message_type: "text", attachments: [] };
  }
  const atts = Array.isArray(msg?.attachments) ? msg.attachments : [];
  if (atts.length) {
    const first = atts[0];
    const type = (first.type as string) || "file";
    const mapped: IncomingContent["message_type"] =
      type === "image" || type === "video" || type === "audio" || type === "file"
        ? (type as any)
        : type === "fallback"
        ? "file"
        : "sticker";
    return {
      text: `[${mapped}]`,
      message_type: mapped,
      attachments: atts.map((a: any) => ({ type: a.type, url: a.payload?.url, sticker_id: a.payload?.sticker_id })),
    };
  }
  return { text: "", message_type: "text", attachments: [] };
}
