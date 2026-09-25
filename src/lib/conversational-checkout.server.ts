import { createHash, randomBytes } from "node:crypto";

const CHECKOUT_TTL_MS = 2 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createConversationalCheckoutLink(input: {
  storeId: string;
  productId: string;
  conversationId?: string | null;
  channel: "messenger" | "whatsapp";
  externalCustomerId: string;
  origin?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CHECKOUT_TTL_MS).toISOString();
  const { error } = await supabaseAdmin.from("conversational_checkout_sessions").insert({
    token_hash: hashToken(token),
    store_id: input.storeId,
    product_id: input.productId,
    conversation_id: input.conversationId ?? null,
    channel: input.channel,
    external_customer_id: input.externalCustomerId,
    expires_at: expiresAt,
  });
  if (error) throw new Error("Checkout link তৈরি করা যায়নি");

  const origin = (input.origin || process.env["PUBLIC_APP_URL"] || "https://orzen.top").replace(/\/$/, "");
  return `${origin}/checkout/fast?token=${encodeURIComponent(token)}`;
}

export async function readConversationalCheckout(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("conversational_checkout_sessions")
    .select("id,store_id,product_id,conversation_id,channel,external_customer_id,quantity,expires_at,used_at,order_id")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function claimConversationalCheckout(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("conversational_checkout_sessions")
    .update({ used_at: now })
    .eq("token_hash", hashToken(token))
    .is("used_at", null)
    .gt("expires_at", now)
    .select("id,store_id,product_id,conversation_id,channel,external_customer_id,quantity,expires_at")
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function releaseConversationalCheckout(sessionId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("conversational_checkout_sessions")
    .update({ used_at: null })
    .eq("id", sessionId)
    .is("order_id", null);
}

export async function attachConversationalOrder(sessionId: string, orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("conversational_checkout_sessions")
    .update({ order_id: orderId })
    .eq("id", sessionId);
}

export async function notifyConversationalOrder(orderId: string, paid = false) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: session }, { data: order }] = await Promise.all([
    supabaseAdmin
      .from("conversational_checkout_sessions")
      .select("id,store_id,conversation_id,channel,external_customer_id")
      .eq("order_id", orderId)
      .maybeSingle(),
    supabaseAdmin
      .from("orders")
      .select("invoice_no,subtotal,delivery_amount,discount_amount")
      .eq("id", orderId)
      .maybeSingle(),
  ]);
  if (!session || !order) return;
  const total = Number(order.subtotal ?? 0) + Number(order.delivery_amount ?? 0) - Number(order.discount_amount ?? 0);
  const text = paid
    ? `✅ পেমেন্ট সফল হয়েছে। অর্ডার #${order.invoice_no} কনফার্ম করা হয়েছে। মোট ৳${total.toFixed(0)}।`
    : `✅ অর্ডার #${order.invoice_no} গ্রহণ করা হয়েছে। মোট ৳${total.toFixed(0)}। শীঘ্রই স্টোর থেকে যোগাযোগ করা হবে।`;

  try {
    if (session.channel === "messenger") {
      const { data: integration } = await supabaseAdmin
        .from("messenger_integrations")
        .select("page_access_token,page_access_token_encrypted")
        .eq("store_id", session.store_id)
        .maybeSingle();
      let token = integration?.page_access_token ?? null;
      if (integration?.page_access_token_encrypted) {
        const { decryptJSON } = await import("@/lib/crypto/credentials.server");
        token = decryptJSON<string>(integration.page_access_token_encrypted);
      }
      if (token) {
        const { sendPostPurchaseUpdate } = await import("@/lib/messenger-send.server");
        await sendPostPurchaseUpdate(token, session.external_customer_id, text);
      }
    } else {
      const { data: integration } = await supabaseAdmin
        .from("whatsapp_integrations")
        .select("phone_number_id,access_token_encrypted")
        .eq("store_id", session.store_id)
        .maybeSingle();
      if (integration?.phone_number_id && integration.access_token_encrypted) {
        const { decryptJSON } = await import("@/lib/crypto/credentials.server");
        const token = decryptJSON<string>(integration.access_token_encrypted);
        const { sendWaText } = await import("@/lib/whatsapp-send.server");
        await sendWaText(integration.phone_number_id, token, session.external_customer_id, text);
      }
    }
    if (session.conversation_id) {
      await supabaseAdmin.from("ai_messages").insert({
        conversation_id: session.conversation_id,
        role: "assistant",
        direction: "out",
        message_type: "text",
        content: text,
        delivery_status: "sent",
      });
    }
  } catch {
    // Checkout/payment remains successful even if Meta temporarily rejects a notification.
  }
}