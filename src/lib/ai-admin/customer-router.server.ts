// Customer branch of the shared Messenger webhook: rate limit -> human-mode
// check -> Customer AI Agent -> reply. Admin tools are never reachable here.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendText } from "@/lib/messenger-send.server";
import {
  appendCustomerMessage,
  ensureCustomerThread,
  escalateToHuman,
  loadCustomerHistory,
} from "./support.server";
import { runCustomerAgent } from "./customer-agent.server";

const CUSTOMER_RATE_PER_MIN = 12;

/** Best-effort public profile name for a Messenger user. */
async function fetchName(pageAccessToken: string, psid: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${psid}?fields=name&access_token=${encodeURIComponent(pageAccessToken)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { name?: string };
    return json.name ?? null;
  } catch {
    return null;
  }
}

export async function handleCustomerMessage(args: {
  psid: string;
  text: string;
  pageAccessToken: string;
  enabled: boolean;
}): Promise<{ error?: string }> {
  const { psid, pageAccessToken } = args;
  const text = (args.text ?? "").trim();
  if (!text) return {};

  const send = (body: string) => sendText(pageAccessToken, psid, body.slice(0, 1900)).catch(() => {});

  // Per-customer rate limit (stricter than the admin path).
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("ai_admin_webhook_events")
    .select("*", { count: "exact", head: true })
    .eq("wa_id", `psid:${psid}`)
    .gte("created_at", since);
  if ((count ?? 0) > CUSTOMER_RATE_PER_MIN) return { error: "Customer rate limited" };

  const thread = await ensureCustomerThread(psid);
  if (!thread) return { error: "Could not open customer thread" };

  if (!thread.display_name) {
    const name = await fetchName(pageAccessToken, psid);
    if (name) {
      await supabaseAdmin.from("ai_admin_customer_threads").update({ display_name: name }).eq("id", thread.id);
      thread.display_name = name;
    }
  }

  await appendCustomerMessage(thread.id, "user", text);

  // A human admin has taken over this conversation: forward, do not auto-reply.
  if (thread.status === "human") {
    const { loadMessengerConnection, sendAdminMessengerMessage } = await import("./messenger.server");
    const conn = await loadMessengerConnection();
    for (const admin of (conn?.admin_psids ?? []).map((p) => String(p).trim()).filter(Boolean)) {
      await sendAdminMessengerMessage(
        admin,
        `💬 ${thread.display_name || "Customer"} (${psid}):\n${text.slice(0, 800)}`,
      ).catch(() => {});
    }
    return {};
  }

  if (!args.enabled) return { error: "Customer agent disabled" };

  const history = await loadCustomerHistory(thread.id, 10);

  let reply = "";
  let error: string | undefined;
  try {
    const result = await runCustomerAgent({
      text,
      history: history.slice(0, -1),
      ctx: {
        psid,
        threadId: thread.id,
        customerName: thread.display_name,
        onEscalate: async (reason, summary) => {
          await escalateToHuman({
            threadId: thread.id,
            psid,
            customerName: thread.display_name,
            reason,
            summary,
          });
        },
      },
    });
    reply = result.reply;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    reply = "দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন।";
  }

  await appendCustomerMessage(thread.id, "assistant", reply);
  await send(reply);
  return error ? { error: error.slice(0, 300) } : {};
}
