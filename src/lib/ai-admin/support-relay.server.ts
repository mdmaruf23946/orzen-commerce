// Two-way human-support relay: the owner talks to the AI in Messenger and the
// AI speaks to the customer on the connected Page, in the owner's words.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendText } from "@/lib/messenger-send.server";
import { loadMessengerConnection, readMessengerCreds } from "./messenger.server";
import { appendCustomerMessage } from "./support.server";

export type SupportTarget = {
  threadId: string;
  psid: string;
  name: string | null;
  requestId: string | null;
  reason: string | null;
  summary: string | null;
};

async function pageToken(): Promise<string> {
  const conn = await loadMessengerConnection();
  const creds = readMessengerCreds(conn);
  if (!creds?.page_access_token) throw new Error("Messenger Page is not connected.");
  return creds.page_access_token;
}

/** Every support conversation currently waiting for the human owner. */
export async function listOpenSupport(): Promise<SupportTarget[]> {
  const { data } = await supabaseAdmin
    .from("ai_admin_support_requests")
    .select("id, psid, customer_name, reason, summary, thread_id, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []).map((r) => ({
    threadId: String(r.thread_id ?? ""),
    psid: String(r.psid),
    name: r.customer_name ?? null,
    requestId: String(r.id),
    reason: r.reason ?? null,
    summary: r.summary ?? null,
  }));
}

/**
 * Resolve which customer the owner means. An explicit PSID or a name fragment
 * wins; otherwise the most recent conversation waiting for a human is used.
 */
export async function resolveTarget(hint?: string | null): Promise<SupportTarget> {
  const open = await listOpenSupport();
  const q = (hint ?? "").trim();

  if (q) {
    if (/^\d{6,}$/.test(q)) {
      const match = open.find((o) => o.psid === q);
      if (match) return match;
      const { data: th } = await supabaseAdmin
        .from("ai_admin_customer_threads")
        .select("id, psid, display_name")
        .eq("psid", q)
        .maybeSingle();
      if (!th) throw new Error(`No Messenger conversation found for ${q}.`);
      return { threadId: th.id, psid: th.psid, name: th.display_name, requestId: null, reason: null, summary: null };
    }
    const byName = open.filter((o) => (o.name ?? "").toLowerCase().includes(q.toLowerCase()));
    if (byName.length === 1) return byName[0]!;
    if (byName.length > 1) {
      throw new Error(`Multiple customers match "${q}": ${byName.map((b) => b.name).join(", ")}. Ask which one.`);
    }

    // Named customer is not in the open list — look them up among known threads.
    const { data: threads } = await supabaseAdmin
      .from("ai_admin_customer_threads")
      .select("id, psid, display_name")
      .ilike("display_name", `%${q}%`)
      .order("last_message_at", { ascending: false })
      .limit(5);
    const hits = threads ?? [];
    if (hits.length === 1) {
      const t = hits[0]!;
      return { threadId: t.id, psid: t.psid, name: t.display_name, requestId: null, reason: null, summary: null };
    }
    if (hits.length > 1) {
      throw new Error(
        `Multiple customers match "${q}": ${hits.map((h) => h.display_name).join(", ")}. Ask which one.`,
      );
    }
    // NEVER fall back to another customer when a specific person was named —
    // that would deliver a private support reply to the wrong inbox.
    throw new Error(
      `No Messenger conversation found for "${q}". Ask the owner which customer they mean` +
        (open.length ? `: ${open.map((o) => o.name ?? o.psid).join(", ")}.` : "."),
    );
  }

  if (open.length === 1) return open[0]!;
  if (open.length > 1) {
    // Most recent one — the owner is normally answering the newest alert.
    return open[0]!;
  }

  // No open request: fall back to the conversation a human most recently took over.
  const { data: th } = await supabaseAdmin
    .from("ai_admin_customer_threads")
    .select("id, psid, display_name")
    .eq("status", "human")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!th) throw new Error("No customer is waiting for a human reply right now.");
  return { threadId: th.id, psid: th.psid, name: th.display_name, requestId: null, reason: null, summary: null };
}

/** Recent transcript of the customer conversation so the owner has context. */
export async function supportHistory(hint?: string | null, limit = 12) {
  const target = await resolveTarget(hint);
  const { data } = await supabaseAdmin
    .from("ai_admin_customer_messages")
    .select("role, content, created_at")
    .eq("thread_id", target.threadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return {
    customer: target.name ?? "Messenger user",
    psid: target.psid,
    reason: target.reason,
    messages: (data ?? []).reverse(),
  };
}

/** Send the owner's message to the customer on the connected Page. */
export async function relayToCustomer(args: { hint?: string | null; message: string }) {
  const body = (args.message ?? "").trim();
  if (!body) throw new Error("Nothing to send — the message is empty.");
  const target = await resolveTarget(args.hint);
  const token = await pageToken();
  await sendText(token, target.psid, body.slice(0, 1900));
  if (target.threadId) await appendCustomerMessage(target.threadId, "admin", body);
  await supabaseAdmin
    .from("ai_admin_customer_threads")
    .update({ status: "human", last_message_at: new Date().toISOString() })
    .eq("psid", target.psid);
  return { sent_to: target.name ?? target.psid, psid: target.psid, message: body };
}

/** Hand the conversation back to the customer AI agent. */
export async function closeSupport(hint?: string | null, note?: string | null) {
  const target = await resolveTarget(hint);
  await supabaseAdmin.from("ai_admin_customer_threads").update({ status: "ai" }).eq("psid", target.psid);
  if (target.requestId) {
    await supabaseAdmin
      .from("ai_admin_support_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", target.requestId);
  }
  return { closed: target.name ?? target.psid, psid: target.psid, note: note ?? null };
}
