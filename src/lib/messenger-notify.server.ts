// Server-only helper: drain order_notifications_outbox for a specific order or all pending.
// Sends Messenger updates to the customer who placed the order.
import { sendPostPurchaseUpdate } from "@/lib/messenger-send.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const STAGE_MESSAGES: Record<string, (o: any) => string> = {
  placed: (o) => `✅ আপনার অর্ডার ${o.invoice_no ? "#" + o.invoice_no : ""} গ্রহণ করা হয়েছে। শীঘ্রই কনফার্ম করা হবে।`,
  confirmed: (o) => `🎉 আপনার অর্ডার ${o.invoice_no ? "#" + o.invoice_no : ""} কনফার্ম হয়েছে। মোট: ৳${o.grand_total}`,
  packed: (o) => `📦 আপনার অর্ডার ${o.invoice_no ? "#" + o.invoice_no : ""} প্যাক করা হয়েছে, কুরিয়ারে হ্যান্ডওভার করা হচ্ছে।`,
  shipped: (o) => `🚚 আপনার অর্ডার ${o.invoice_no ? "#" + o.invoice_no : ""} শিপ করা হয়েছে।${o.courier_tracking_id ? " ট্র্যাকিং: " + o.courier_tracking_id : ""}`,
  delivered: (o) => `✅ আপনার অর্ডার ${o.invoice_no ? "#" + o.invoice_no : ""} ডেলিভারি সম্পন্ন হয়েছে। ধন্যবাদ!`,
  cancelled: (o) => `❌ আপনার অর্ডার ${o.invoice_no ? "#" + o.invoice_no : ""} বাতিল হয়েছে। প্রয়োজনে আমাদের সাথে যোগাযোগ করুন।`,
  returned: (o) => `↩️ আপনার অর্ডার ${o.invoice_no ? "#" + o.invoice_no : ""} রিটার্ন হিসাবে রেকর্ড করা হয়েছে।`,
  courier_assigned: (o) => `🚚 আপনার অর্ডার ${o.invoice_no ? "#" + o.invoice_no : ""} কুরিয়ারে অ্যাসাইন করা হয়েছে।`,
};

async function decryptToken(enc: string | null | undefined): Promise<string | null> {
  if (!enc) return null;
  try {
    const { decryptJSON } = await import("@/lib/crypto/credentials.server");
    return decryptJSON<string>(enc);
  } catch {
    return null;
  }
}

export async function drainOutbox(opts: { orderId?: string; limit?: number; latestOnly?: boolean; latestPerOrder?: boolean } = {}) {
  const limit = opts.limit ?? 50;
  let q = supabaseAdmin
    .from("order_notifications_outbox")
    .select("id,order_id,store_id,stage,attempt_count,created_at")
    .is("sent_at", null)
    .lt("attempt_count", 4)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (opts.orderId) q = q.eq("order_id", opts.orderId);
  const { data: pending } = await q;

  const rows = [...(pending ?? [])];
  if (opts.latestOnly || opts.latestPerOrder) {
    const staleIds: string[] = [];
    const latestRows: typeof rows = [];
    if (opts.orderId) {
      if (rows.length > 1) staleIds.push(...rows.slice(0, -1).map((row) => row.id));
      if (rows.length) latestRows.push(rows[rows.length - 1]);
    } else {
      const byOrder = new Map<string, typeof rows>();
      for (const row of rows) byOrder.set(row.order_id, [...(byOrder.get(row.order_id) ?? []), row]);
      for (const group of byOrder.values()) {
        if (group.length > 1) staleIds.push(...group.slice(0, -1).map((row) => row.id));
        latestRows.push(group[group.length - 1]);
      }
      latestRows.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    }
    if (staleIds.length) {
      await supabaseAdmin
        .from("order_notifications_outbox")
        .update({ sent_at: new Date().toISOString(), error: "superseded" })
        .in("id", staleIds);
    }
    rows.splice(0, rows.length, ...latestRows);
  }

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const builder = STAGE_MESSAGES[row.stage];
      if (!builder) {
        await supabaseAdmin
          .from("order_notifications_outbox")
          .update({ sent_at: new Date().toISOString(), error: "no_template" })
          .eq("id", row.id);
        continue;
      }

      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id,invoice_no,phone,subtotal,delivery_amount,courier_tracking_id")
        .eq("id", row.order_id)
        .maybeSingle();
      if (!order) throw new Error("order_missing");
      const orderView = {
        ...order,
        grand_total: Number(order.subtotal ?? 0) + Number(order.delivery_amount ?? 0),
      };
      const text = builder(orderView);

      const phoneNorm = order.phone ? String(order.phone).replace(/\D/g, "") : null;
      // Try multiple phone normalizations (raw, 0xxxxx, 880xxxx)
      const candidates = new Set<string>();
      if (order.phone) candidates.add(String(order.phone));
      if (phoneNorm) {
        candidates.add(phoneNorm);
        if (phoneNorm.startsWith("880")) candidates.add("0" + phoneNorm.slice(3));
        if (phoneNorm.startsWith("0")) candidates.add("880" + phoneNorm.slice(1));
      }

      const { data: notification } = await supabaseAdmin
        .from("admin_notifications")
        .select("meta")
        .eq("store_id", row.store_id)
        .eq("kind", "new_order")
        .contains("meta", { order_id: row.order_id })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const conversationId = (notification as any)?.meta?.conversation_id as string | undefined;

      let conv: { id: string; external_id: string | null } | null = null;
      if (conversationId) {
        const { data } = await supabaseAdmin
          .from("ai_conversations")
          .select("id,external_id")
          .eq("id", conversationId)
          .eq("store_id", row.store_id)
          .eq("channel", "messenger")
          .not("external_id", "is", null)
          .maybeSingle();
        conv = data as typeof conv;
      }

      if (!conv?.external_id) {
        const { data } = await supabaseAdmin
          .from("ai_conversations")
          .select("id,external_id")
          .eq("store_id", row.store_id)
          .eq("channel", "messenger")
          .contains("psid_profile", { last_order: { order_id: row.order_id } })
          .not("external_id", "is", null)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        conv = data as typeof conv;
      }

      if (!conv?.external_id && candidates.size > 0) {
        const { data } = await supabaseAdmin
          .from("ai_conversations")
          .select("id,external_id")
          .eq("store_id", row.store_id)
          .eq("channel", "messenger")
          .in("phone", Array.from(candidates))
          .not("external_id", "is", null)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        conv = data as typeof conv;
      }

      if (!conv?.external_id) {
        await supabaseAdmin
          .from("order_notifications_outbox")
          .update({ sent_at: new Date().toISOString(), error: "no_psid" })
          .eq("id", row.id);
        continue;
      }

      const { data: integ } = await supabaseAdmin
        .from("messenger_integrations")
        .select("page_access_token,page_access_token_encrypted,status")
        .eq("store_id", row.store_id)
        .maybeSingle();
      const token =
        (await decryptToken((integ as any)?.page_access_token_encrypted)) ||
        (integ as any)?.page_access_token;
      if (!token) throw new Error("no_page_token");

      await sendPostPurchaseUpdate(token, conv.external_id, text);

      await supabaseAdmin.from("ai_messages").insert({
        conversation_id: conv.id,
        role: "assistant",
        direction: "out",
        message_type: "text",
        content: text,
        delivery_status: "sent",
      } as any);

      await supabaseAdmin
        .from("order_notifications_outbox")
        .update({ sent_at: new Date().toISOString(), error: null })
        .eq("id", row.id);
      sent++;
    } catch (e) {
      failed++;
      await supabaseAdmin
        .from("order_notifications_outbox")
        .update({
          attempt_count: (row.attempt_count ?? 0) + 1,
          error: (e as Error).message.slice(0, 500),
        })
        .eq("id", row.id);
    }
  }
  return { sent, failed, considered: rows.length };
}
