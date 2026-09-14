// Customer -> human admin handoff for the Messenger Customer AI Agent.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadMessengerConnection, sendAdminMessengerMessage } from "./messenger.server";

export type CustomerThread = {
  id: string;
  psid: string;
  display_name: string | null;
  status: string;
};

/** Find or create the customer conversation thread for a Messenger PSID. */
export async function ensureCustomerThread(psid: string, displayName?: string | null): Promise<CustomerThread | null> {
  const { data: existing } = await supabaseAdmin
    .from("ai_admin_customer_threads")
    .select("id, psid, display_name, status")
    .eq("psid", psid)
    .maybeSingle();
  if (existing) return existing as CustomerThread;
  const { data } = await supabaseAdmin
    .from("ai_admin_customer_threads")
    .insert({ psid, display_name: displayName ?? null })
    .select("id, psid, display_name, status")
    .maybeSingle();
  return (data as CustomerThread | null) ?? null;
}

export async function appendCustomerMessage(threadId: string, role: "user" | "assistant" | "admin", content: string) {
  await supabaseAdmin.from("ai_admin_customer_messages").insert({ thread_id: threadId, role, content });
  await supabaseAdmin
    .from("ai_admin_customer_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);
}

export async function loadCustomerHistory(threadId: string, limit = 10) {
  const { data } = await supabaseAdmin
    .from("ai_admin_customer_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse().map((m) => ({
    role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
    content: m.content,
  }));
}

/**
 * Creates a support request and alerts every verified admin PSID.
 * Never throws — an escalation failure must not break the customer reply.
 */
export async function escalateToHuman(args: {
  threadId: string | null;
  psid: string;
  customerName: string | null;
  reason: string;
  summary: string;
}) {
  try {
    // Do not stack duplicate open requests for the same customer.
    const { data: open } = await supabaseAdmin
      .from("ai_admin_support_requests")
      .select("id")
      .eq("psid", args.psid)
      .eq("status", "open")
      .maybeSingle();

    if (!open) {
      await supabaseAdmin.from("ai_admin_support_requests").insert({
        thread_id: args.threadId,
        psid: args.psid,
        customer_name: args.customerName,
        reason: args.reason.slice(0, 300),
        summary: args.summary.slice(0, 1000),
      });
    }

    const conn = await loadMessengerConnection();
    const psids = (conn?.admin_psids ?? []).map((p) => String(p).trim()).filter(Boolean);
    const text =
      `🚨 Human Support Required\n\n` +
      `Customer: ${args.customerName || "Messenger user"}\n` +
      `Messenger ID: ${args.psid}\n` +
      `Issue: ${args.summary.slice(0, 500)}\n` +
      `Reason: ${args.reason.slice(0, 200)}\n\n` +
      `Open Winner Admin → AI Admin Control → Customer Support to reply.`;
    for (const admin of psids) {
      await sendAdminMessengerMessage(admin, text).catch(() => {});
    }
  } catch {
    /* escalation is best effort */
  }
}
