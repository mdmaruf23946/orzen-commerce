// WhatsApp Cloud API webhook — per-store, signature verified.
// Mirrors the Messenger webhook flow: log event → upsert conversation →
// store inbound message → AI reply (unless a human took over).
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Database } from "@/integrations/supabase/types";
import {
  buildSystemPrompt,
  generateAgentReply,
  loadAiContext,
  loadOrderFlow,
  resolveFocusProduct,
} from "@/lib/ai-agent.server";
import { sanitizeOutgoingText } from "@/lib/messenger-text";
import { ORDER_FIELD_LABELS, requiredSlotFields, type OrderFieldKey } from "@/lib/messenger-order-flow";
import { friendlyWaError, sendWaText, markWaRead } from "@/lib/whatsapp-send.server";
import { buildBuyNowMessage, fetchDeliveryZones } from "@/lib/chat-order-format";

const ORDER_FIELD_BN: Record<string, string> = {
  customer_name: "নাম",
  phone: "ফোন নম্বর",
  district: "জেলা",
  upazila: "থানা/উপজেলা",
  union: "ইউনিয়ন",
  village: "গ্রাম",
  area: "এলাকা",
  full_address: "সম্পূর্ণ ঠিকানা",
  qty: "পরিমাণ",
  payment_method: "পেমেন্ট মাধ্যম",
  note: "অতিরিক্ত নোট",
};

function admin() {
  return createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function decrypt(enc: string | null | undefined) {
  if (!enc) return null;
  try {
    const mod = await import("@/lib/crypto/credentials.server");
    return mod.decryptJSON<string>(enc);
  } catch {
    return null;
  }
}

function verifySignature(raw: string, header: string | null, appSecret: string) {
  if (!header) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function upsertConversation(sb: any, storeId: string, waId: string, profileName?: string | null) {
  const { data: existing } = await sb
    .from("ai_conversations")
    .select("id,unread_count,handoff_mode,customer_name,psid_profile")
    .eq("store_id", storeId)
    .eq("channel", "whatsapp")
    .eq("external_id", waId)
    .maybeSingle();
  if (existing) {
    if (profileName && !existing.customer_name) {
      await sb.from("ai_conversations").update({ customer_name: profileName }).eq("id", existing.id);
    }
    return { conv: existing, created: false };
  }
  const { data: created } = await sb
    .from("ai_conversations")
    .insert({
      store_id: storeId,
      channel: "whatsapp",
      external_id: waId,
      customer_name: profileName ?? null,
      phone: waId,
      handoff_mode: "ai",
      status: "open",
      unread_count: 0,
      first_contact_at: new Date().toISOString(),
    })
    .select("id,unread_count,handoff_mode,customer_name,psid_profile")
    .single();
  return { conv: created, created: true };
}

async function logInbound(
  sb: any,
  conversationId: string,
  opts: { text: string; type: string; attachments?: any[]; mid?: string | null },
) {
  await sb.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "user",
    direction: "in",
    message_type: opts.type,
    content: opts.text,
    attachments: opts.attachments ?? [],
    mid: opts.mid ?? null,
    delivery_status: "received",
  } as any);
}

async function sendAndLog(
  sb: any,
  phoneNumberId: string,
  token: string,
  to: string,
  conversationId: string,
  text: string,
) {
  try {
    const res = await sendWaText(phoneNumberId, token, to, text);
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      direction: "out",
      message_type: "text",
      content: text,
      mid: res.message_id ?? null,
      delivery_status: "sent",
    } as any);
    await sb
      .from("ai_conversations")
      .update({ last_message_at: new Date().toISOString(), last_message_preview: text.slice(0, 200) })
      .eq("id", conversationId);
  } catch (e) {
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      direction: "out",
      message_type: "text",
      content: text,
      delivery_status: "failed",
      error: friendlyWaError((e as Error).message),
    } as any);
  }
}

async function pendingOrder(sb: any, conversationId: string) {
  const { data } = await sb.from("ai_conversations").select("psid_profile").eq("id", conversationId).maybeSingle();
  return (((data as any)?.psid_profile ?? {}).pending_order ?? {}) as Record<string, any>;
}

async function patchPendingOrder(sb: any, conversationId: string, patch: Record<string, any>) {
  const { data } = await sb.from("ai_conversations").select("psid_profile").eq("id", conversationId).maybeSingle();
  const profile = { ...(((data as any)?.psid_profile ?? {}) as Record<string, any>) };
  profile["pending_order"] = { ...(profile["pending_order"] ?? {}), ...patch };
  await sb.from("ai_conversations").update({ psid_profile: profile } as any).eq("id", conversationId);
  return profile["pending_order"] as Record<string, any>;
}

/** "Buy now" button → start the store-configured order flow for a physical product. */
async function handleBuyButton(opts: {
  sb: any;
  storeId: string;
  conversationId: string;
  to: string;
  token: string;
  phoneNumberId: string;
  productId: string;
}) {
  const { sb, storeId, conversationId, to, token, phoneNumberId, productId } = opts;
  const { data: product } = await sb
    .from("products")
    .select("id,name,slug,price,stock,status,product_type,delivery_charge")
    .eq("store_id", storeId)
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.status !== "active") {
    await sendAndLog(sb, phoneNumberId, token, to, conversationId, "দুঃখিত, এই প্রোডাক্টটি এখন পাওয়া যাচ্ছে না।");
    return;
  }
  if (String(product.product_type ?? "physical") !== "physical") {
    const { data: store } = await sb.from("stores").select("slug").eq("id", storeId).maybeSingle();
    const origin = (process.env["PUBLIC_APP_URL"] || "https://orzen.top").replace(/\/$/, "");
    const url = `${origin}/store/${store?.slug ?? "store"}/product/${product.id}`;
    await sendAndLog(
      sb,
      phoneNumberId,
      token,
      to,
      conversationId,
      `এই প্রোডাক্টটি আমাদের ওয়েবসাইট থেকে নিরাপদে কিনতে পারবেন:\n${url}`,
    );
    return;
  }
  if (Number(product.stock) <= 0) {
    await sendAndLog(sb, phoneNumberId, token, to, conversationId, "দুঃখিত, এই প্রোডাক্টটি এখন স্টকে নেই।");
    return;
  }

  const current = await pendingOrder(sb, conversationId);
  const slot = await patchPendingOrder(sb, conversationId, {
    ...current,
    product_id: product.id,
    product_name: product.name,
    qty: current["qty"] ?? 1,
  });
  const cfg = await loadOrderFlow(storeId);
  const missing = requiredSlotFields(cfg)
    .filter((k) => k !== "product_id" && k !== "payment_method" && !slot[k])
    .map((k) => ORDER_FIELD_BN[k] ?? ORDER_FIELD_LABELS[k as OrderFieldKey] ?? k);
  const zones = await fetchDeliveryZones(sb, storeId);
  const text = missing.length
    ? buildBuyNowMessage({
        productName: product.name,
        price: Number(product.price ?? 0),
        qty: Number(slot["qty"] ?? 1) || 1,
        zones,
        productDeliveryCharge: product.delivery_charge,
        intro: cfg.buy_now_message,
      })
    : `${product.name} অর্ডারের সব তথ্য পেয়েছি। কনফার্ম করতে "হ্যাঁ" লিখুন।`;
  await sendAndLog(sb, phoneNumberId, token, to, conversationId, text);
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      // Meta webhook verification
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        if (mode !== "subscribe" || !token) return new Response("Bad request", { status: 400 });
        const sb = admin();
        const { data } = await sb
          .from("whatsapp_integrations")
          .select("id")
          .eq("verify_token", token)
          .maybeSingle();
        if (!data) return new Response("Forbidden", { status: 403 });
        return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-hub-signature-256");
        let body: any;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("ok", { status: 200 });
        }
        const sb = admin();

        for (const entry of body?.entry ?? []) {
          for (const change of entry?.changes ?? []) {
            const value = change?.value ?? {};
            const phoneNumberId = value?.metadata?.phone_number_id as string | undefined;
            if (!phoneNumberId) continue;

            const { data: integ } = await sb
              .from("whatsapp_integrations")
              .select("*")
              .eq("phone_number_id", phoneNumberId)
              .maybeSingle();
            if (!integ) continue;

            const appSecret = await decrypt((integ as any).app_secret_encrypted);
            if (appSecret) {
              if (!verifySignature(raw, signature, appSecret)) {
                await sb.from("whatsapp_webhook_events").insert({
                  store_id: (integ as any).store_id,
                  phone_number_id: phoneNumberId,
                  event_type: "invalid_signature",
                  error: "Signature verification failed",
                } as any);
                return new Response("Invalid signature", { status: 401 });
              }
            } else {
              // Legacy integrations connected before the app secret became required:
              // keep delivering messages, but record a warning so the admin can fix it.
              await sb.from("whatsapp_webhook_events").insert({
                store_id: (integ as any).store_id,
                phone_number_id: phoneNumberId,
                event_type: "unverified_webhook",
                error: "No app secret configured — webhook accepted without signature verification",
              } as any);
            }



            const storeId = (integ as any).store_id as string;
            const token = await decrypt((integ as any).access_token_encrypted);

            // --- Delivery / read statuses ---
            for (const st of value?.statuses ?? []) {
              await sb.from("whatsapp_webhook_events").insert({
                store_id: storeId,
                phone_number_id: phoneNumberId,
                event_type: `status:${st.status}`,
                external_id: `st_${st.id}_${st.status}`,
                payload: st,
                error: st?.errors?.[0]?.title ?? null,
              } as any);
              const status = String(st.status ?? "");
              const mapped = status === "failed" ? "failed" : status === "read" ? "read" : status;
              await sb
                .from("ai_messages")
                .update({
                  delivery_status: mapped,
                  ...(st?.errors?.[0]?.title ? { error: friendlyWaError(st.errors[0].title) } : {}),
                } as any)
                .eq("mid", st.id);
            }

            // --- Incoming messages ---
            for (const msg of value?.messages ?? []) {
              const waId = String(msg.from ?? "");
              if (!waId) continue;
              const profileName = value?.contacts?.[0]?.profile?.name ?? null;

              await sb.from("whatsapp_webhook_events").insert({
                store_id: storeId,
                phone_number_id: phoneNumberId,
                event_type: `message:${msg.type}`,
                external_id: msg.id ?? null,
                payload: { from: waId, type: msg.type },
              } as any);

              const { conv, created } = await upsertConversation(sb, storeId, waId, profileName);
              if (!conv) continue;

              let text = "";
              let type = String(msg.type ?? "text");
              let buttonPayload: string | null = null;
              const attachments: any[] = [];
              if (msg.type === "text") text = msg.text?.body ?? "";
              else if (msg.type === "interactive") {
                const inter = msg.interactive ?? {};
                buttonPayload = inter?.button_reply?.id ?? inter?.list_reply?.id ?? null;
                text = inter?.button_reply?.title ?? inter?.list_reply?.title ?? "";
                type = "quick_reply";
              } else if (msg.type === "button") {
                buttonPayload = msg.button?.payload ?? null;
                text = msg.button?.text ?? "";
                type = "quick_reply";
              } else if (["image", "video", "audio", "document", "sticker"].includes(String(msg.type))) {
                text = msg[msg.type]?.caption ?? `[${msg.type}]`;
                attachments.push({ type: msg.type, media_id: msg[msg.type]?.id ?? null });
              } else {
                text = `[${msg.type}]`;
              }

              // Merchant command path: only a verified merchant identity of THIS
              // store reaches the Master Agent; everyone else keeps the existing
              // customer flow.
              if (text.trim()) {
                try {
                  const { handleMerchantChannelMessage } = await import(
                    "@/lib/merchant-ai/router.server"
                  );
                  const merchant = await handleMerchantChannelMessage(
                    sb,
                    storeId,
                    "whatsapp",
                    waId,
                    text,
                  );
                  if (merchant?.handled) {
                    if (token) await sendWaText(phoneNumberId, token, waId, merchant.reply);
                    continue;
                  }
                } catch (err) {
                  // Must never break customer messaging — but must be visible in the logs.
                  try {
                    const { logActivity } = await import("@/lib/merchant-ai/core.server");
                    await logActivity(sb as any, storeId, {
                      agent: "master",
                      actionKey: "channel_router_failed",
                      level: "error",
                      message: err instanceof Error ? err.message : "Merchant command router failed",
                      meta: { channel: "whatsapp" },
                    });
                  } catch {
                    /* logging must not break delivery */
                  }
                }

              }

              await logInbound(sb, conv.id, { text, type, attachments, mid: msg.id ?? null });
              await sb
                .from("ai_conversations")
                .update({
                  last_message_at: new Date().toISOString(),
                  last_message_preview: (text || `[${type}]`).slice(0, 200),
                  unread_count: (conv.unread_count ?? 0) + 1,
                  status: "open",
                })
                .eq("id", conv.id);
              await sb
                .from("whatsapp_integrations")
                .update({
                  last_webhook_at: new Date().toISOString(),
                  last_webhook_type: `message:${msg.type}`,
                  last_webhook_error: null,
                } as any)
                .eq("id", (integ as any).id);

              // Notify the store admin about new conversations / messages.
              try {
                const { dispatchNotification } = await import("@/lib/notify-dispatch.server");
                void dispatchNotification(sb, {
                  storeId,
                  event: created ? "new_order" : "order_status",
                  subject: created ? "New WhatsApp conversation" : "New WhatsApp message",
                  message: `${profileName || waId}: ${(text || `[${type}]`).slice(0, 300)}`,
                });
              } catch {
                /* notifications are best-effort */
              }

              if (!token) continue;
              if (msg.id) void markWaRead(phoneNumberId, token, msg.id);

              // AI reply gate — a human takeover silences the agent.
              if (((conv as any).handoff_mode ?? "ai") !== "ai") continue;
              if ((integ as any).human_takeover || (integ as any).ai_auto_reply === false) continue;

              // "Buy now" button
              if (buttonPayload && /^BUY_[0-9a-f-]{36}$/i.test(buttonPayload)) {
                await handleBuyButton({
                  sb,
                  storeId,
                  conversationId: conv.id,
                  to: waId,
                  token,
                  phoneNumberId,
                  productId: buttonPayload.replace(/^BUY_/, ""),
                });
                continue;
              }

              if (!text.trim() || (type !== "text" && type !== "quick_reply")) continue;

              try {
                const { store, agent, settings } = await loadAiContext(storeId);
                const useHistory = (integ as any).conversation_history !== false;
                const history = useHistory
                  ? (
                      await sb
                        .from("ai_messages")
                        .select("role,content,message_type")
                        .eq("conversation_id", conv.id)
                        .in("message_type", ["text", "quick_reply"])
                        .order("created_at", { ascending: false })
                        .limit(30)
                    ).data ?? []
                  : [];
                const messages = [...history]
                  .reverse()
                  .filter((m: any) => m.role === "user" || m.role === "assistant")
                  .map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }));
                const latest = [...messages].reverse().find((m) => m.role === "user")?.content?.trim();
                if (latest !== text.trim()) messages.push({ role: "user", content: text.trim() });

                const pending = await pendingOrder(sb, conv.id);
                const focus = await resolveFocusProduct({ storeId, conversationId: conv.id, text });

                const reply = await generateAgentReply({
                  ctx: {
                    storeId,
                    storeSlug: (store as any).slug,
                    conversationId: conv.id,
                    channel: "whatsapp",
                    waTo: waId,
                    waToken: token,
                    waPhoneNumberId: phoneNumberId,
                    focusProductId: focus.product?.id ?? null,
                  },
                  messages,
                  system: buildSystemPrompt(store, agent, {
                    channel: "whatsapp",
                    settings,
                    state: { pending_order: pending, last_order: null, recent_product_ids: [] },
                    focus,
                    latestUserText: text,
                  }),
                  fast: true,
                });

                const replyText = sanitizeOutgoingText(reply?.text ?? "", reply?.facts ?? {});
                if (replyText) await sendAndLog(sb, phoneNumberId, token, waId, conv.id, replyText);
                await sb.from("whatsapp_integrations").update({ last_error: null } as any).eq("id", (integ as any).id);
              } catch (e) {
                await sb
                  .from("whatsapp_integrations")
                  .update({ last_error: friendlyWaError((e as Error).message) } as any)
                  .eq("id", (integ as any).id);
              }
            }
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
