// Website event -> WhatsApp notification for the platform owner.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadConnection, loadSettings, sendAdminMessage } from "./connection.server";

export type AdminEventKey =
  | "new_user"
  | "new_subscription"
  | "payment"
  | "new_order"
  | "failed_payment"
  | "pending_subscription"
  | "system_alert";

function render(template: string, vars: Record<string, string | number | null | undefined>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => {
    const v = vars[k];
    return v === null || v === undefined || v === "" ? "—" : String(v);
  });
}

/**
 * Sends the WhatsApp notification for an event when its rule is enabled and the
 * connection is live. Never throws — notification failures must not break the
 * business flow that triggered them.
 */
export async function notifyAdminEvent(
  event: AdminEventKey,
  vars: Record<string, string | number | null | undefined>,
  opts?: { test?: boolean },
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const [{ data: rule }, settings, conn] = await Promise.all([
      supabaseAdmin.from("ai_admin_notification_rules").select("*").eq("event_key", event).maybeSingle(),
      loadSettings(),
      loadConnection(),
    ]);
    if (!rule || !rule.enabled) return { sent: false, reason: "Notification disabled" };
    if (!conn || conn.status !== "connected") return { sent: false, reason: "WhatsApp not connected" };

    const recipients = rule.recipient
      ? [rule.recipient]
      : ((settings?.admin_numbers as string[] | null) ?? []);
    if (recipients.length === 0) return { sent: false, reason: "No admin number configured" };

    const body = render(rule.template || "{{message}}", {
      time: new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }),
      ...vars,
    });
    const text = opts?.test ? `🧪 TEST EVENT\n\n${body}` : body;

    for (const to of recipients) {
      await sendAdminMessage(to, text);
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
