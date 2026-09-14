// Event-driven merchant notifications: panel bell + verified channels.
import type { Db } from "./core.server";
import { verifiedIdentities } from "./identity.server";

export type NotifyInput = {
  event: string;
  title: string;
  body?: string;
  actionTarget?: string;
  priority?: "low" | "normal" | "high";
};

async function ruleFor(db: Db, storeId: string, event: string) {
  const { data } = await db
    .from("store_ai_notification_rules")
    .select("enabled, channels")
    .eq("store_id", storeId)
    .eq("event_key", event)
    .maybeSingle();
  if (!data) return { enabled: true, channels: ["panel"] as string[] };
  return { enabled: !!data.enabled, channels: (data.channels ?? ["panel"]) as string[] };
}

async function ownerUserId(db: Db, storeId: string) {
  const { data } = await db.from("stores").select("owner_id").eq("id", storeId).maybeSingle();
  return (data?.owner_id as string | undefined) ?? null;
}

async function sendMessenger(db: Db, storeId: string, psids: string[], text: string) {
  if (!psids.length) return;
  const { data } = await db
    .from("messenger_integrations")
    .select("page_access_token_encrypted, status")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!data?.page_access_token_encrypted) return;
  let token: string | null = null;
  try {
    const { decryptJSON } = await import("@/lib/crypto/credentials.server");
    token = decryptJSON<string>(data.page_access_token_encrypted);
  } catch {
    return;
  }
  if (!token) return;
  const { sendText } = await import("@/lib/messenger-send.server");
  for (const psid of psids) {
    try {
      await sendText(token, psid, text);
    } catch {
      /* delivery failure must not break the caller */
    }
  }
}

async function sendWhatsapp(db: Db, storeId: string, numbers: string[], text: string) {
  if (!numbers.length) return;
  const { data } = await db
    .from("whatsapp_integrations")
    .select("phone_number_id, access_token_encrypted")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!data?.phone_number_id || !data?.access_token_encrypted) return;
  let token: string | null = null;
  try {
    const { decryptJSON } = await import("@/lib/crypto/credentials.server");
    token = decryptJSON<string>(data.access_token_encrypted);
  } catch {
    return;
  }
  if (!token) return;
  const { sendWaText } = await import("@/lib/whatsapp-send.server");
  for (const to of numbers) {
    try {
      await sendWaText(data.phone_number_id, token, to, text);
    } catch {
      /* ignore */
    }
  }
}

export async function notifyMerchantEvent(db: Db, storeId: string, input: NotifyInput) {
  const rule = await ruleFor(db, storeId, input.event);
  if (!rule.enabled) return { sent: false, reason: "rule_disabled" };

  const text = `${input.title}${input.body ? `\n\n${input.body}` : ""}`;

  if (rule.channels.includes("panel")) {
    const uid = await ownerUserId(db, storeId);
    await db.from("admin_notifications").insert({
      store_id: storeId,
      user_id: uid,
      kind: "ai_command_center",
      type: input.event,
      title: input.title.slice(0, 160),
      body: (input.body ?? "").slice(0, 1000),
      priority: input.priority ?? "normal",
      action_type: input.actionTarget ? "link" : null,
      action_target: input.actionTarget ?? null,
      action_label: input.actionTarget ? "Open" : null,
      meta: { source: "merchant_ai" },
    });
  }

  if (rule.channels.includes("messenger")) {
    const ids = await verifiedIdentities(db, storeId, "messenger");
    await sendMessenger(db, storeId, ids.map((i) => i.identifier), text);
  }

  if (rule.channels.includes("whatsapp")) {
    const ids = await verifiedIdentities(db, storeId, "whatsapp");
    await sendWhatsapp(db, storeId, ids.map((i) => i.identifier), text);
  }

  return { sent: true };
}
