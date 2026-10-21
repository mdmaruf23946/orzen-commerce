import { customerTexts } from "@/lib/agents/customer-style";
import { guardConversation, resolveHandoff } from "./conversation-guard.server";
// WhatsApp Cloud API webhook — per-store, signature verified.
// Mirrors the Messenger webhook flow: log event → upsert conversation →
// store inbound message → AI reply (unless a human took over).
import { traceTime, setTraceMeta } from "./telemetry.server";
import { firstSighting, forget } from "./mid-dedupe";
import { cached } from "./ttl-cache.server";
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
import { sanitizeSlot } from "@/lib/slot-validate";
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

export const DEBOUNCE_MS = 2500;

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
    // Use the customer's real WhatsApp profile name unless the merchant set one.
    if (profileName && (!existing.customer_name || existing.customer_name === waId)) {
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
    delivery_status: "delivered",
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
    const res = await traceTime("send", () => sendWaText(phoneNumberId, token, to, text));
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
  const profile = ((data as any)?.psid_profile ?? {}) as Record<string, any>;
  // Drop a question/greeting that was stored as a name or address earlier.
  const { slot, dropped } = sanitizeSlot((profile.pending_order ?? {}) as Record<string, any>);
  if (dropped.length) {
    await sb.from("ai_conversations").update({ psid_profile: { ...profile, pending_order: slot } } as any).eq("id", conversationId);
  }
  return slot;
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
        missing,
        known: slot,
      })
    : `${product.name} অর্ডারের সব তথ্য পেয়েছি। কনফার্ম করতে "হ্যাঁ" লিখুন।`;
  await sendAndLog(sb, phoneNumberId, token, to, conversationId, text);
}

/** Customer photo → same-store product via fingerprint/vector search (no AI chat call). */
async function handleWaPhoto(opts: {
  sb: any; storeId: string; conversationId: string; to: string; token: string; phoneNumberId: string; jobId: string; mediaId: string;
}): Promise<string | null> {
  const { sb, storeId, conversationId, to, token, phoneNumberId, jobId, mediaId } = opts;
  try {
    const { getWaMediaUrl, sendWaImage, sendWaButtons } = await import("@/lib/whatsapp-send.server");
    const url = await getWaMediaUrl(mediaId, token);
    if (!url) return null;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0]!.trim();
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { findProductByPhoto } = await import("@/lib/photo-match.server");
    const found = await findProductByPhoto(sb, storeId, bytes, mime);
    const { getStoreMemory } = await import("@/lib/catalog-memory.server");
    const memory = await getStoreMemory(sb, storeId);
    const money = (n: unknown) => `৳${Number(n ?? 0).toLocaleString("en-IN")}`;
    const imgUrl = (p: any) => {
      const v = p?.primary_image_url as string | null;
      if (!v) return null;
      const origin = (process.env["PUBLIC_SITE_ORIGIN"] || "https://orzen.top").replace(/\/$/, "");
      return /^https?:/i.test(v) ? v : `${origin}/api/img/${v.replace(/^\/+/, "").replace(/^api\/img\//, "")}`;
    };
    let reply: string;
    if (found.product) {
      const p: any = found.product;
      reply = `এটা আমাদের "${p.name}"।\nদাম: ${money(p.price)}${Number(p.stock) > 0 ? "" : " (এখন স্টকে নেই)"}`;
      const link = imgUrl(p);
      if (link) await sendWaImage(phoneNumberId, token, to, link, p.name).catch(() => null);
      await sendWaButtons(phoneNumberId, token, to, reply, [{ id: `BUY_${p.id}`, title: "Buy Now" }]);
      await logOutbound(sb, conversationId, reply);
    } else if (found.candidateIds.length) {
      const list = found.candidateIds.slice(0, 3).map((id) => memory.byId.get(id)?.product).filter(Boolean) as any[];
      reply = `ছবির সাথে মিল আছে এমন পণ্য:\n${list.map((p, i) => `${i + 1}. ${p.name} — ${money(p.price)}`).join("\n")}\nকোনটা চাচ্ছেন জানালে অর্ডার করে দেব।`;
      await sendWaButtons(phoneNumberId, token, to, reply, list.map((p) => ({ id: `BUY_${p.id}`, title: String(p.name).slice(0, 20) })));
      await logOutbound(sb, conversationId, reply);
    } else {
      return null; // let the AI answer with alternatives
    }
    await sb.from("whatsapp_jobs").update({ reply_text: reply, route: `fast:photo_${found.method ?? "candidates"}` }).eq("id", jobId);
    console.log(`[wa-photo] store=${storeId} method=${found.method ?? "none"} score=${found.score.toFixed(3)} ms=${found.ms}`);
    return reply;
  } catch (e) {
    console.log(`[wa-photo] failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

async function logOutbound(sb: any, conversationId: string, text: string) {
  await sb.from("ai_messages").insert({
    conversation_id: conversationId, role: "assistant", content: text, direction: "outbound", message_type: "text", delivery_status: "sent",
  });
}

/** Meta webhook verification (GET). */
export async function handleWhatsAppVerify(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  if (mode !== "subscribe" || !token) return new Response("Bad request", { status: 400 });
  const sb = admin();
  const { data } = await sb.from("whatsapp_integrations").select("id").eq("verify_token", token).maybeSingle();
  if (!data) return new Response("Forbidden", { status: 403 });
  return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

export type WaJobPayload = {
  text: string;
  type: string;
  button_payload: string | null;
  profile_name: string | null;
  media_id?: string | null;
};

/**
 * Webhook (POST): verify → store → queue → ACK. No AI and no Meta send work
 * happens here, so Meta always gets its answer quickly.
 */
export async function handleWhatsAppWebhook(request: Request) {
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

      // Integration settings are store-level config: cache 60s per isolate.
      const { data: integ } = await cached(`wa-integ:${phoneNumberId}`, 60_000, async () =>
        await sb.from("whatsapp_integrations").select("*").eq("phone_number_id", phoneNumberId).maybeSingle(),
      );
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
        await sb.from("whatsapp_webhook_events").insert({
          store_id: (integ as any).store_id,
          phone_number_id: phoneNumberId,
          event_type: "unverified_webhook",
          error: "No app secret configured — webhook accepted without signature verification",
        } as any);
      }

      const storeId = (integ as any).store_id as string;

      await Promise.all((value?.statuses ?? []).map(async (st: any) => {
        await sb.from("whatsapp_webhook_events").insert({
          store_id: storeId,
          phone_number_id: phoneNumberId,
          event_type: `status:${st.status}`,
          external_id: `st_${st.id}_${st.status}`,
          payload: st,
          error: st?.errors?.[0]?.title ?? null,
        } as any);
        await sb
          .from("ai_messages")
          .update({
            delivery_status: String(st.status ?? ""),
            ...(st?.errors?.[0]?.title ? { error: friendlyWaError(st.errors[0].title) } : {}),
          } as any)
          .eq("mid", st.id);
      }));

      for (const msg of value?.messages ?? []) {
        const waId = String(msg.from ?? "");
        const mid = String(msg.id ?? "");
        if (!waId || !mid) continue;
        // Fast first line: drop Meta re-deliveries before any database work.
        const dedupeKey = `wa:${phoneNumberId}:${mid}`;
        if (!firstSighting(dedupeKey)) continue;
        const profileName = value?.contacts?.[0]?.profile?.name ?? null;

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

        const { conv, created } = await upsertConversation(sb, storeId, waId, profileName);
        if (!conv) { forget(dedupeKey); return new Response("Conversation store failed", { status: 500 }); }

        // Unique (phone_number_id, message_id): a Meta retry never creates a second job.
        const payload: WaJobPayload = {
          text,
          type,
          button_payload: buttonPayload,
          profile_name: profileName,
          media_id: attachments[0]?.media_id ?? null,
        };
        const { data: job, error: jobErr } = await (sb as any)
          .from("whatsapp_jobs")
          .upsert(
            {
              store_id: storeId,
              integration_id: (integ as any).id,
              phone_number_id: phoneNumberId,
              sender_id: waId,
              message_id: mid,
              conversation_id: conv.id,
              event_payload: payload,
              // Debounce plain text so a burst of messages gets one reply;
              // buttons (Buy Now) and media stay instant.
              available_at: new Date(Date.now() + (type === "text" ? DEBOUNCE_MS : 0)).toISOString(),
            },
            { onConflict: "phone_number_id,message_id", ignoreDuplicates: true },
          )
          .select("id");
        if (jobErr) { forget(dedupeKey); return new Response("Queue failed", { status: 500 }); }
        if (!job || (job as any[]).length === 0) continue; // duplicate delivery

        // Recovery + bookkeeping run in parallel so Meta gets 200 fast.
        const kickStuck = async () => {
          const { data: stuck } = await (sb as any)
            .from("whatsapp_jobs")
            .select("id")
            .in("status", ["pending", "retry"])
            .lt("available_at", new Date(Date.now() - 60_000).toISOString())
            .order("available_at", { ascending: true })
            .limit(25);
          await Promise.all(((stuck ?? []) as any[]).map((s) =>
            (sb as any).rpc("kick_whatsapp_job", { _job_id: s.id }).then(() => null, () => null),
          ));
        };
        await Promise.all([
          kickStuck().catch(() => null),
          sb.from("whatsapp_webhook_events").insert({
            store_id: storeId,
            phone_number_id: phoneNumberId,
            event_type: `message:${msg.type}`,
            external_id: mid,
            payload: { from: waId, type: msg.type },
          } as any),
          logInbound(sb, conv.id, { text, type, attachments, mid }),
          sb
            .from("ai_conversations")
            .update({
              last_message_at: new Date().toISOString(),
              last_message_preview: (text || `[${type}]`).slice(0, 200),
              unread_count: (conv.unread_count ?? 0) + 1,
              status: "open",
            })
            .eq("id", conv.id),
          sb
            .from("whatsapp_integrations")
            .update({
              last_webhook_at: new Date().toISOString(),
              last_webhook_type: `message:${msg.type}`,
              last_webhook_error: null,
            } as any)
            .eq("id", (integ as any).id),
        ]);

        try {
          const { dispatchNotification } = await import("@/lib/notify-dispatch.server");
          void dispatchNotification(sb, {
            storeId,
            event: created ? "new_order" : "order_status",
            subject: created ? "New WhatsApp conversation" : "New WhatsApp message",
            message: `${profileName || waId}: ${(text || `[${type}]`).slice(0, 300)}`,
          });
        } catch {
          /* best-effort */
        }
      }
    }
  }

  return new Response("ok", { status: 200 });
}

export type WaJobRow = {
  id: string;
  wake_token: string;
  store_id: string;
  integration_id: string;
  phone_number_id: string;
  sender_id: string;
  message_id: string;
  conversation_id: string | null;
  event_payload: WaJobPayload;
  attempts: number;
  reply_text: string | null;
};

export const WA_FALLBACK_TEXT =
  "দুঃখিত, এই মুহূর্তে উত্তর দিতে একটু সমস্যা হচ্ছে। আমাদের টিম শীঘ্রই আপনার সাথে যোগাযোগ করবে। / Sorry, we're having a brief issue — our team will reply shortly.";

export async function sendWhatsAppFallback(job: WaJobRow) {
  const sb = admin();
  const { data: integ } = await sb.from("whatsapp_integrations").select("*").eq("id", job.integration_id).maybeSingle();
  const token = integ ? await decrypt((integ as any).access_token_encrypted) : null;
  if (!token || !job.conversation_id) return;
  await sendAndLog(sb, job.phone_number_id, token, job.sender_id, job.conversation_id, WA_FALLBACK_TEXT);
}

/** Worker: produce and send the reply for one claimed job. Throws on retryable failure. */
export async function processWhatsAppJob(job: WaJobRow): Promise<{ reply: string | null; skipped?: string }> {
  const sb = admin();
  const { data: integ } = await sb.from("whatsapp_integrations").select("*").eq("id", job.integration_id).maybeSingle();
  if (!integ) return { reply: null, skipped: "integration removed" };
  const token = await decrypt((integ as any).access_token_encrypted);
  if (!token) return { reply: null, skipped: "no access token" };

  const storeId = job.store_id;
  const phoneNumberId = job.phone_number_id;
  const waId = job.sender_id;
  const { text = "", type = "text", button_payload: buttonPayload = null } = job.event_payload ?? ({} as WaJobPayload);
  const conversationId = job.conversation_id;
  if (!conversationId) return { reply: null, skipped: "no conversation" };
  if ((job.event_payload as any)?.dry_run === true && String(job.message_id ?? "").startsWith("loadtest_")) {
    setTraceMeta("dry_run", true);
  }

  void markWaRead(phoneNumberId, token, job.message_id);

  if (text.trim()) {
    try {
      const { handleMerchantChannelMessage } = await import("@/lib/merchant-ai/router.server");
      const merchant = await handleMerchantChannelMessage(sb, storeId, "whatsapp", waId, text);
      if (merchant?.handled) {
        await sendWaText(phoneNumberId, token, waId, merchant.reply);
        return { reply: merchant.reply };
      }
    } catch (err) {
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

  // Read fresh so a human takeover made after queueing is honoured.
  const { data: conv } = await sb.from("ai_conversations").select("id,handoff_mode,handoff_reason,handoff_at").eq("id", conversationId).maybeSingle();
  if (!conv) return { reply: null, skipped: "conversation removed" };
  if (((conv as any).handoff_mode ?? "ai") !== "ai") {
    const h = await resolveHandoff(sb, conv as any);
    if (!h.resume) {
      if (h.ack) {
        try { await sendAndLog(sb, phoneNumberId, token, waId, conversationId, h.ack); } catch { /* best effort */ }
        return { reply: h.ack };
      }
      return { reply: null, skipped: "human handoff" };
    }
  }
  if ((integ as any).human_takeover || (integ as any).ai_auto_reply === false)
    return { reply: null, skipped: "auto-reply off" };
  if (await guardConversation(sb, conversationId)) return { reply: null, skipped: "spam guard" };

  if (buttonPayload && /^BUY_[0-9a-f-]{36}$/i.test(buttonPayload)) {
    await handleBuyButton({
      sb,
      storeId,
      conversationId,
      to: waId,
      token,
      phoneNumberId,
      productId: buttonPayload.replace(/^BUY_/, ""),
    });
    return { reply: "[buy-now flow]" };
  }

  if (type === "image" && (job.event_payload as WaJobPayload)?.media_id) {
    setTraceMeta("route", "photo");
    const handled = await traceTime("photo", () => handleWaPhoto({
      sb, storeId, conversationId, to: waId, token, phoneNumberId, jobId: job.id,
      mediaId: String((job.event_payload as WaJobPayload).media_id),
    }));
    if (handled) return { reply: handled };
  }

  if (!text.trim() || (type !== "text" && type !== "quick_reply")) return { reply: null, skipped: "non-text" };

  // Fast path: greetings, thanks and verified order-status lookups — no AI call.
  try {
    const { tryFastPath } = await import("@/lib/fast-path.server");
    const fast = await tryFastPath(sb, { storeId, conversationId, text, customerPhone: waId });
    if (fast) {
      setTraceMeta("route", "fast");
      setTraceMeta("fast_kind", fast.kind);
      await sendAndLog(sb, phoneNumberId, token, waId, conversationId, fast.reply);
      await (sb as any).from("whatsapp_jobs").update({ reply_text: fast.reply, route: `fast:${fast.kind}` }).eq("id", job.id);
      return { reply: fast.reply };
    }
  } catch {
    /* fall through to AI */
  }

  try {
    const { store, agent, settings } = await loadAiContext(storeId);
    const useHistory = (integ as any).conversation_history !== false;
    const compact = (integ as any).compact_memory !== false;
    const { loadConversationContext, memoryCard, refreshSummary } = await import("./conversation-context.server");
    const [cc, focus] = await Promise.all([
      loadConversationContext(sb, { conversationId, compact, useHistory, latestText: text }),
      resolveFocusProduct({ storeId, conversationId, text }),
    ]);

    setTraceMeta("route", "ai");
    // Job-level cap: finish (or fail into a clean retry) well inside the
    // worker's request budget instead of being killed mid-run.
    const withCap = <T,>(p: Promise<T>) => Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("AI reply took too long (45s cap)")), 45_000)),
    ]);
    const reply = await traceTime("ai", () => withCap(generateAgentReply({
      ctx: {
        storeId,
        storeSlug: (store as any).slug,
        conversationId,
        channel: "whatsapp",
        waTo: waId,
        waToken: token,
        waPhoneNumberId: phoneNumberId,
        focusProductId: focus.product?.id ?? null,
      },
      messages: cc.messages,
      system: buildSystemPrompt(store, agent, {
        channel: "whatsapp",
        settings,
        state: {
          pending_order: cc.pending_order,
          last_order: cc.last_order,
          recent_product_ids: cc.memory.recent_product_ids ?? [],
          memory_card: compact ? memoryCard(cc.memory) : null,
        },
        focus,
        latestUserText: text,
        customerHistory: customerTexts(cc.messages as any[]),
      }),
      fast: true,
    })));

    const rawText = reply?.text ?? "";
    let guardedText = rawText;
    if (reply?.verified && !reply.raw && rawText.trim()) {
      const { guardReply, logGuardCorrections } = await import("@/lib/reply-guard.server");
      const g = await traceTime("guard", () => guardReply(sb, rawText, reply.verified, { storeId, focusProductId: focus?.product?.id ?? null }));
      guardedText = g.text;
      await logGuardCorrections(sb, conversationId, g, rawText);
    }
    const replyText = sanitizeOutgoingText(guardedText, reply?.facts ?? {});
    if (replyText) {
      await sendAndLog(sb, phoneNumberId, token, waId, conversationId, replyText);
      // Record at once so a later crash never re-sends this reply.
      await (sb as any).from("whatsapp_jobs").update({ reply_text: replyText, route: "ai" }).eq("id", job.id);
    }
    if (compact) await refreshSummary(sb, cc, conversationId);
    await sb.from("whatsapp_integrations").update({ last_error: null } as any).eq("id", (integ as any).id);
    return { reply: replyText || null };
  } catch (e) {
    const message = (e as Error).message || "AI reply failed";
    await sb
      .from("whatsapp_integrations")
      .update({ last_error: `AI reply failed: ${message.slice(0, 300)}` } as any)
      .eq("id", (integ as any).id);
    throw e;
  }
}
