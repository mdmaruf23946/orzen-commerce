// Shared entry points for the public webhook and queue worker.
import { customerTexts } from "@/lib/agents/customer-style";
import { guardConversation, resolveHandoff } from "./conversation-guard.server";
import { traceTime, setTraceMeta } from "./telemetry.server";
import { firstSighting, forget } from "./mid-dedupe";
import { buildSystemPrompt, generateAgentReply, loadAiContext, resolveFocusProduct } from "@/lib/ai-agent.server";
import { sendText } from "@/lib/messenger-send.server";
import { sanitizeOutgoingText } from "@/lib/messenger-text";
import { isAffirmative, isNegative } from "@/lib/slot-validate";
import { isCatalogBrowseIntent } from "@/lib/catalog-browse-intent";
import { isGreetingIntent, isSmallTalkIntent, smallTalkReply, sanitizeMessengerReply } from "./messenger-intents";
import { parseOrderDetailsTextEx } from "./messenger-order-text";
import { type ImageAnalysis, type VisualMatch } from "./messenger-types";
import { visuallyMatchProduct } from "./messenger-visual-match.server";
import { verifyMessengerSignature, decryptToken, fetchPsidProfile, profileIsStale } from "./messenger-graph.server";
import { admin } from "./messenger-client.server";
import { fbSend, fbTyping, alreadyAnsweredOnRetry, markQueuedReply, logOutgoingText, parseMessage } from "./messenger-transport.server";
import { getConversationPendingOrder, handleOrderDecision, maybeApplyPendingOrderText, handleBuyPostback } from "./messenger-orders.server";
import { searchDirectProducts, isNameOnlyProductQuery, availabilityStripped, sendVisualProductResult, sendCatalogBrowseReply, maybeSendDirectProductReply } from "./messenger-catalog.server";
import { humanPhotoFallback, humanTextFallback, transcribeAudioAttachment, describeImageAttachment, fastImageLookup } from "./messenger-media.server";

export { handleBuyPostback } from "./messenger-orders.server";
export { availabilityStripped, isNameOnlyProductQuery } from "./messenger-catalog.server";

export async function handleMessengerVerify(request: Request): Promise<Response> {
  {
    {
      {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && token) {
          const sb = admin();
          const { data } = await sb
            .from("messenger_integrations")
            .select("id")
            .eq("verify_token", token)
            .maybeSingle();
          if (data) return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      }
    }
  }
}

export async function handleMessengerWebhook(request: Request): Promise<Response> {
  {
    {
      {
        // Facebook signs every webhook delivery. Read the RAW body first so the
        // HMAC is computed over the exact bytes Facebook signed.
        const rawBody = await request.text();
        const signatureHeader =
          request.headers.get("x-hub-signature-256") || request.headers.get("X-Hub-Signature-256");
        const queuedJobId = request.headers.get("x-orzen-queue-job");
        const queuedMessageId = request.headers.get("x-orzen-queue-mid");
        const fallbackOnly = request.headers.get("x-orzen-queue-fallback") === "1";
        let queuedProcessingError: Error | null = null;
        let body: any = null;
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = null;
        }
        if (!body || (body.object !== "page" && body.object !== "instagram")) {
          return new Response("ok");
        }
        // Page feed events (comments/posts) belong to the Facebook Page module.
        // Forward the exact signed body; that endpoint verifies the signature
        // again with the Page's own App Secret and resolves its own store.
        if (!queuedJobId && (body.entry ?? []).some((e: any) => Array.isArray(e?.changes) && e.changes.length)) {
          const target = new URL("/api/public/facebook/webhook", request.url);
          const headers = new Headers({ "content-type": "application/json", "x-orzen-facebook-routed": "page" });
          if (signatureHeader) headers.set("x-hub-signature-256", signatureHeader);
          try {
            await fetch(target, { method: "POST", headers, body: rawBody });
          } catch {
            /* comment sync is best-effort; never fail the delivery */
          }
          if (!(body.entry ?? []).some((e: any) => Array.isArray(e?.messaging) && e.messaging.length)) {
            return new Response("ok");
          }
        }

        const sb = admin();
        // Instagram DMs arrive on the same webhook (object "instagram", entry.id =
        // Instagram business account) and reuse the linked Page's integration,
        // token and AI pipeline; only the conversation channel differs.
        const channel: "messenger" | "instagram" = body.object === "instagram" ? "instagram" : "messenger";
        for (const entry of body.entry ?? []) {
          const pageId = String(entry.id);
          const { data: integ } = await sb
            .from("messenger_integrations")
            .select(
              "id,store_id,page_access_token,page_access_token_encrypted,app_secret_encrypted,ai_auto_reply,human_takeover,conversation_history,compact_memory,delivery_failures,reply_delay_seconds,reply_speed,app_id,verify_token,page_id",
            )
            .eq(channel === "instagram" ? "instagram_account_id" : "page_id", pageId)
            .maybeSingle();
          if (!integ) continue;

          // Facebook signs every delivery. Unsigned events are untrusted and are
          // never processed: without an App Secret anyone who knows the public
          // Page ID could forge customer messages and drive the AI order flow.
          const appSecret = await decryptToken((integ as any).app_secret_encrypted);
          if (!appSecret) {
            await sb
              .from("messenger_integrations")
              .update({
                last_error:
                  "App Secret সেট করা নেই — নিরাপত্তার কারণে webhook ইভেন্ট গ্রহণ করা হচ্ছে না। App Secret যোগ করুন।",
              })
              .eq("id", (integ as any).id);
            continue;
          }
          if (!signatureHeader) continue;
          if (!(await verifyMessengerSignature(rawBody, signatureHeader, appSecret))) continue;

          // Normal Facebook deliveries only perform the durable write. The insert
          // wakes an independent processor, allowing Facebook to receive 200
          // immediately instead of waiting for AI generation and Graph delivery.
          if (!queuedJobId) {
            for (const ev of entry.messaging ?? []) {
              const incoming = ev?.message;
              const senderId = String(ev?.sender?.id ?? "");
              const messageId = String(incoming?.mid ?? "");
              if (!senderId || !messageId || incoming?.is_echo) continue;
              const dedupeKey = `${pageId}:${messageId}`;
              if (!firstSighting(dedupeKey)) continue;
              const { error: queueError } = await sb.from("messenger_jobs").upsert(
                {
                  store_id: integ.store_id,
                  integration_id: (integ as any).id,
                  page_id: pageId,
                  sender_id: senderId,
                  message_id: messageId,
                  event_payload: { raw: rawBody, signature: signatureHeader, message_id: messageId },
                  available_at: new Date(
                    Date.now() + Math.max(0, Number((integ as any).reply_delay_seconds ?? 0)) * 1000,
                  ).toISOString(),
                } as any,
                { onConflict: "page_id,message_id", ignoreDuplicates: true },
              );
              // Never lose a message: if the durable write failed, forget the
              // mid so Meta's redelivery is accepted, and ask Meta to retry.
              if (queueError) {
                forget(dedupeKey);
                return new Response("Queue write failed", { status: 500 });
              }
            }
            // Message events are now queued; everything else (postbacks,
            // delivery/read receipts, opt-ins, referrals) is still handled
            // inline below because it is cheap and must not be dropped.
          }



          const token =
            (await decryptToken((integ as any).page_access_token_encrypted)) ||
            (integ as any).page_access_token;

          // Card "Buy Now" taps need the messaging_postbacks webhook field.
          if (token) {
            try {
              const { ensurePostbacksDelivered } = await import("@/lib/messenger-subscribe.server");
              const res = await ensurePostbacksDelivered({
                pageId: String((integ as any).page_id ?? pageId),
                token,
                appId: (integ as any).app_id ?? null,
                appSecret: appSecret,
                verifyToken: (integ as any).verify_token ?? null,
              });
              if (res.page || res.app) {
                console.log("[messenger] postback subscription", pageId, JSON.stringify(res));
              }
            } catch (e) {
              console.warn("[messenger] postback check failed", (e as Error).message);
            }
          }


          // Handle standby events (log only)
          for (const _st of entry.standby ?? []) {
            // no-op, we don't have thread control
          }

          for (const ev of entry.messaging ?? []) {
            const senderId = ev.sender?.id;
            if (!senderId) continue;
            // Incoming customer messages are answered by the queue worker.
            if (!queuedJobId && ev.message?.mid && !ev.message?.is_echo) continue;

            try {
              // deliveries / reads update outgoing message status by mids
              if (ev.delivery?.mids?.length) {
                await sb
                  .from("ai_messages")
                  .update({ delivery_status: "delivered" })
                  .in("mid", ev.delivery.mids)
                  .neq("delivery_status", "read");
                continue;
              }
              if (ev.read?.watermark) {
                // mark all outgoing before watermark as read for this conversation
                const { data: convRow } = await sb
                  .from("ai_conversations")
                  .select("id")
                  .eq("store_id", integ.store_id)
                  .eq("channel", channel)
                  .eq("external_id", senderId)
                  .maybeSingle();
                if (convRow) {
                  const iso = new Date(ev.read.watermark).toISOString();
                  await sb
                    .from("ai_messages")
                    .update({ delivery_status: "read" })
                    .eq("conversation_id", convRow.id)
                    .eq("direction", "out")
                    .lte("created_at", iso);
                }
                continue;
              }

              // Ensure conversation
              let { data: conv } = await sb
                .from("ai_conversations")
                .select("id,psid_profile,unread_count,handoff_mode,handoff_reason,handoff_at")
                .eq("store_id", integ.store_id)
                .eq("channel", channel)
                .eq("external_id", senderId)
                .maybeSingle();
              if (!conv) {
                const profile = token ? await fetchPsidProfile(token, senderId, channel) : null;
                const name = profile
                  ? (profile["name"] as string | undefined) ||
                    [profile["first_name"], profile["last_name"]].filter(Boolean).join(" ") ||
                    null
                  : null;
                const { data: created } = await sb
                  .from("ai_conversations")
                  .insert({
                    store_id: integ.store_id,
                    channel,
                    external_id: senderId,
                    customer_name: name,
                    psid_profile: profile ?? {},
                  })
                  .select("id,psid_profile,unread_count,handoff_mode,handoff_reason,handoff_at")
                  .single();
                conv = created;
              } else if (token && profileIsStale(conv.psid_profile as any)) {
                const profile = await fetchPsidProfile(token, senderId, channel);
                if (profile) {
                  const fbName =
                    (profile["name"] as string | undefined) ||
                    [profile["first_name"], profile["last_name"]].filter(Boolean).join(" ") ||
                    null;
                  await sb
                    .from("ai_conversations")
                    .update({
                      // keep order/pending data stored alongside the profile
                      psid_profile: { ...((conv.psid_profile ?? {}) as Record<string, any>), ...profile },
                      ...(fbName ? { customer_name: fbName } : {}),
                    })
                    .eq("id", conv.id);
                }
              }

              // Remember where the customer came from (post / ad / link) for the Inbox panel.
              {
                const ref: any = ev.referral ?? ev.postback?.referral ?? ev.message?.referral ?? null;
                if (ref && conv) {
                  try {
                    const ads = ref.ads_context_data ?? {};
                    const source = {
                      type: ref.source === "ADS" || ref.ad_id ? "ad" : ref.post_id || ads.post_id ? "post" : String(ref.source ?? "link").toLowerCase(),
                      post_id: ref.post_id ?? ads.post_id ?? null,
                      ad_id: ref.ad_id ?? null,
                      ref: ref.ref ?? null,
                      title: ads.ad_title ?? null,
                      photo: ads.photo_url ?? null,
                      at: new Date().toISOString(),
                    };
                    const { data: fresh } = await sb.from("ai_conversations").select("psid_profile").eq("id", conv.id).maybeSingle();
                    await sb.from("ai_conversations")
                      .update({ psid_profile: { ...(((fresh as any)?.psid_profile ?? {}) as Record<string, any>), source } })
                      .eq("id", conv.id);
                  } catch { /* never block messages */ }
                }
              }

              // Optins / referrals — log as system rows, no reply
              if (ev.optin || ev.referral) {
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "system",
                  direction: "in",
                  message_type: "text",
                  content: ev.optin ? "[opt-in]" : "[referral]",
                  attachments: [ev.optin ?? ev.referral],
                });
                continue;
              }

              // Postback
              if (ev.postback) {
                const preview = ev.postback.title || ev.postback.payload || "[postback]";
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "user",
                  direction: "in",
                  message_type: "postback",
                  content: preview,
                  attachments: [{ payload: ev.postback.payload, title: ev.postback.title }],
                });
                await sb
                  .from("ai_conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: preview.slice(0, 200),
                    unread_count: (conv!.unread_count ?? 0) + 1,
                  })
                  .eq("id", conv!.id);
                const handoff = (conv as any)!.handoff_mode ?? "ai";
                if (
                  handoff === "ai" &&
                  token &&
                  !(integ as any).human_takeover &&
                  (integ as any).ai_auto_reply !== false &&
                  String(ev.postback.payload ?? "").startsWith("BUY_")
                ) {
                  await handleBuyPostback({
                    sb,
                    storeId: integ.store_id,
                    conversationId: conv!.id,
                    psid: senderId,
                    token,
                    payload: String(ev.postback.payload),
                    queuedJobId,
                  });
                  await sb
                    .from("messenger_integrations")
                    .update({ last_error: null } as any)
                    .eq("id", (integ as any).id);
                }
                continue;
              }

              // messages event
              const msg = ev.message;
              if (!msg || msg.is_echo) continue;
              if (queuedMessageId && String(msg.mid ?? "") !== queuedMessageId) continue;
              if (String(msg.mid ?? "").startsWith("loadtest_")) setTraceMeta("dry_run", true);
              if (msg.mid) {
                const { data: existingMessage } = await sb
                  .from("ai_messages")
                  .select("id")
                  .eq("mid", msg.mid)
                  .maybeSingle();
                if (existingMessage && !queuedJobId) continue;
              }
              const parsed = parseMessage(msg);
              const sourceCreatedAt = Number(ev.timestamp) > 0
                ? new Date(Number(ev.timestamp)).toISOString()
                : new Date().toISOString();

              // "Buy now" taps: card buttons arrive as postbacks, quick replies
              // arrive as ordinary messages. Both mean the same intent and must
              // start the order flow instead of going to the LLM as raw text.
              const qrPayload = String((parsed.attachments?.[0] as any)?.payload ?? "");
              if (parsed.message_type === "quick_reply" && (/^BUY_[0-9a-f-]{36}$/i.test(qrPayload) || /^VAR\|[0-9a-f-]{36}\|/i.test(qrPayload))) {
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "user",
                  direction: "in",
                  message_type: "quick_reply",
                  content: msg.text || "Buy Now",
                  attachments: parsed.attachments,
                  mid: msg.mid ?? null,
                  created_at: sourceCreatedAt,
                });
                await sb
                  .from("ai_conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: (msg.text || "Buy Now").slice(0, 200),
                    unread_count: (conv!.unread_count ?? 0) + 1,
                  })
                  .eq("id", conv!.id);
                const qrHandoff = (conv as any)!.handoff_mode ?? "ai";
                if (
                  qrHandoff === "ai" &&
                  token &&
                  !(integ as any).human_takeover &&
                  (integ as any).ai_auto_reply !== false
                ) {
                  await handleBuyPostback({
                    sb,
                    storeId: integ.store_id,
                    conversationId: conv!.id,
                    psid: senderId,
                    token,
                    payload: qrPayload,
                    queuedJobId,
                  });
                }
                continue;
              }


              // Voice notes: transcribe upstream so the LLM sees text, not "[audio]".
              let effectiveText = parsed.text;
              let imageAnalysis: ImageAnalysis | null = null;
              let imageMatch: VisualMatch | null = null;
              if (parsed.message_type === "audio") {
                const audioUrl = (parsed.attachments?.[0]?.url as string) || "";
                const transcript = await transcribeAudioAttachment(audioUrl);
                effectiveText = transcript
                  ? transcript
                  : "[The customer sent a voice message that could not be understood. Reply briefly in Bangla asking them to send it again or type the message.]";
                if (transcript) {
                  void sb.from("ai_messages").update({ content: `[voice] ${transcript}` })
                    .eq("conversation_id", conv!.id).eq("mid", String(msg.mid ?? "")).then(() => {}, () => {});
                }
              }
              // Photos: describe the image so the agent can look the item up in the
              // catalogue instead of leaving the customer with silence.
              if (parsed.message_type === "image") {
                const imageUrl = (parsed.attachments?.[0]?.url as string) || "";
                if (fallbackOnly) {
                  const fallback = humanPhotoFallback();
                  const sent = await fbSend(token, senderId, fallback);
                  await markQueuedReply(sb, queuedJobId, fallback, sent.message_id);
                  await sb.from("ai_messages").insert({
                    conversation_id: conv!.id,
                    role: "assistant",
                    direction: "out",
                    message_type: "text",
                    content: fallback,
                    attachments: [{ in_reply_to_mid: msg.mid ?? null, image_processing_failed: true }],
                    mid: sent.message_id ?? null,
                    delivery_status: "sent",
                  });
                  continue;
                }
                // Fast path: an unambiguous photo-fingerprint match against this
                // store's own products answers in ~1s; anything uncertain falls
                // through to the full AI inspection below.
                const fast = await fastImageLookup(sb, integ.store_id, imageUrl, token, String(msg.mid ?? ""));
                // When the photo reader is slow/busy, never make the customer wait
                // through minutes of retries: answer once, like a shop assistant.
                let seen: ImageAnalysis;
                try {
                  seen = fast.analysis
                    ?? await describeImageAttachment(imageUrl, token, String(msg.mid ?? ""), fast.photo);
                  imageMatch = fast.match ?? (seen.is_product
                    ? await visuallyMatchProduct(sb, integ.store_id, seen, fast.candidateIds)
                    : null);
                } catch (imgErr) {
                  console.warn("[messenger] photo read failed, human-style reply", (imgErr as Error).message);
                  const soft = humanPhotoFallback();
                  const sent = await fbSend(token, senderId, soft);
                  await markQueuedReply(sb, queuedJobId, soft, sent.message_id);
                  await sb.from("ai_messages").insert({
                    conversation_id: conv!.id, role: "assistant", direction: "out", message_type: "text",
                    content: soft,
                    attachments: [{ in_reply_to_mid: msg.mid ?? null, image_processing_failed: true }],
                    mid: sent.message_id ?? null, delivery_status: "sent",
                  });
                  continue;
                }
                {
                  imageAnalysis = seen;
                  const terms = seen.keywords.length ? ` Search terms: ${seen.keywords.join(", ")}.` : "";
                  effectiveText = seen.is_product
                    ? `[The customer sent a photo of a product. The photo shows: ${seen.description}.${terms}] ` +
                      `Use the synchronized store catalogue as the authoritative product list; do not browse the website. ` +
                      `If found, show the product card with price and stock and ask if this is the one they want. ` +
                      `If nothing matching exists, say politely in the customer's own language that this product is not available right now, ` +
                      `mention what you saw in the photo, and offer the closest alternatives. Never invent a product.`
                    : `[The customer sent a photo. The photo shows: ${seen.description}.] ` +
                      `Answer about this photo naturally in the customer's language. Do not search the product catalogue unless they ask.`;
                  parsed.attachments = (parsed.attachments ?? []).map((a: any, i: number) => i === 0 ? {
                    ...a,
                    ai_description: seen.description,
                    ai_keywords: seen.keywords,
                    is_product: seen.is_product,
                    visual_attributes: {
                      product_type: seen.product_type,
                      product_subtype: seen.product_subtype,
                      category: seen.category,
                      primary_color: seen.primary_color,
                      secondary_colors: seen.secondary_colors,
                      material: seen.material,
                      style: seen.style,
                      shape: seen.shape,
                      pattern: seen.pattern,
                      visible_text: seen.visible_text,
                      brand: seen.brand,
                      model_number: seen.model_number,
                      functions: seen.functions,
                      connectors: seen.connectors,
                      controls: seen.controls,
                      package_specs: seen.package_specs,
                      distinctive_features: seen.distinctive_features,
                      field_confidence: seen.field_confidence,
                      visibility_warnings: seen.visibility_warnings,
                      object_boundary_confidence: seen.object_boundary_confidence,
                      text_legibility: seen.text_legibility,
                      recognition_status: seen.recognition_status,
                      inspection_passes: seen.inspection_passes,
                      confidence: seen.confidence,
                    },
                    matched_product_id: imageMatch?.verdict === "exact" ? imageMatch.product.id : null,
                    visual_match_verdict: imageMatch?.verdict ?? "none",
                    visual_match_confidence: imageMatch?.confidence ?? 0,
                    visual_match_reason: imageMatch?.reason ?? null,
                    visual_match_evidence: imageMatch?.evidence ?? [],
                  } : a);
                }
              }

              // Merchant command path: only a verified merchant identity of THIS
              // store reaches the Master Agent. Everyone else falls through to
              // the existing customer flow untouched.
              if (effectiveText) {
                try {
                  const { handleMerchantChannelMessage } = await import(
                    "@/lib/merchant-ai/router.server"
                  );
                  // Merchant commands are linked to Messenger identities only.
                  const merchant = channel === "instagram" ? null : await handleMerchantChannelMessage(
                    sb,
                    integ.store_id,
                    "messenger",
                    senderId,
                    effectiveText,
                  );
                  if (merchant?.handled) {
                    if (token) {
                      const result = await sendText(token, senderId, merchant.reply);
                      await markQueuedReply(sb, queuedJobId, merchant.reply, (result as any)?.message_id ?? null);
                    }
                    continue;
                  }
                } catch (err) {
                  // Never break the customer flow — but never swallow it silently either.
                  try {
                    const { logActivity } = await import("@/lib/merchant-ai/core.server");
                    await logActivity(sb as any, integ.store_id, {
                      agent: "master",
                      actionKey: "channel_router_failed",
                      level: "error",
                      message: err instanceof Error ? err.message : "Merchant command router failed",
                      meta: { channel },
                    });
                  } catch {
                    /* logging must not break delivery */
                  }
                }

              }

              const preview = effectiveText.slice(0, 200) || `[${parsed.message_type}]`;

              if (!msg.mid || !(await sb.from("ai_messages").select("id").eq("mid", msg.mid).maybeSingle()).data) {
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "user",
                  direction: "in",
                  message_type: parsed.message_type,
                  content: effectiveText || preview,
                  attachments: parsed.attachments,
                  mid: msg.mid ?? null,
                  created_at: sourceCreatedAt,
                });
                await sb
                  .from("ai_conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: preview,
                    unread_count: (conv!.unread_count ?? 0) + 1,
                  })
                  .eq("id", conv!.id);
              }

              // AI reply gate
              const handoff = (conv as any)!.handoff_mode ?? "ai";
              if (handoff !== "ai") {
                // Never leave the customer in silence while in human mode.
                const h = await resolveHandoff(sb, conv as any);
                if (!h.resume) {
                  if (h.ack && token) {
                    try {
                      const sent = await fbSend(token, senderId, h.ack);
                      await markQueuedReply(sb, queuedJobId, h.ack, sent.message_id);
                      await logOutgoingText(sb, conv!.id, h.ack, sent.message_id ?? null);
                    } catch (e) { console.warn("[messenger] handoff ack failed", (e as Error).message); }
                  }
                  continue;
                }
              }
              if ((integ as any).human_takeover || (integ as any).ai_auto_reply === false) continue;
              if (!token) continue;
              if (await guardConversation(sb, conv!.id)) continue;
              // A retried job whose earlier attempt already sent a card/text must
              // never send it again (that caused 3–4 duplicate cards + bills).
              if (queuedJobId && (await alreadyAnsweredOnRetry(sb, queuedJobId, conv!.id))) {
                await markQueuedReply(sb, queuedJobId, "[already sent by earlier attempt]", null);
                continue;
              }
              // Audio was transcribed and images were described above; stickers and
              // files still have no text form, so they do not reach the LLM.
              if (
                parsed.message_type !== "text" &&
                parsed.message_type !== "quick_reply" &&
                parsed.message_type !== "audio" &&
                parsed.message_type !== "image"
              ) continue;
              if (!effectiveText.trim()) continue;

              // Product photos are resolved deterministically from the current
              // image turn. This prevents an older recommendation or free-form
              // model reply from replacing the newest photo's product context.
              if (parsed.message_type === "image" && imageAnalysis?.is_product) {
                const { data: storeRow } = await sb
                  .from("stores")
                  .select("slug")
                  .eq("id", integ.store_id)
                  .maybeSingle();
                await sendVisualProductResult({
                  sb,
                  token,
                  psid: senderId,
                  conversationId: conv!.id,
                  storeId: integ.store_id,
                  storeSlug: storeRow?.slug,
                  sourceMid: msg.mid ?? null,
                  queuedJobId,
                  analysis: imageAnalysis,
                  match: imageMatch,
                });
                await sb
                  .from("messenger_integrations")
                  .update({ last_error: null } as any)
                  .eq("id", (integ as any).id);
                // Photo fingerprints are unavailable on the current provider
                // keys, so nothing is indexed here any more.
                continue;
              }

              if (fallbackOnly) {
                const fallback = humanTextFallback(/[\u0980-\u09ff]/.test(effectiveText) || !/[a-z]{3}/i.test(effectiveText));
                const sent = await fbSend(token, senderId, fallback);
                await markQueuedReply(sb, queuedJobId, fallback, sent.message_id);
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "assistant",
                  direction: "out",
                  message_type: "text",
                  content: fallback,
                  mid: sent.message_id ?? null,
                  delivery_status: "sent",
                });
                continue;
              }

              // Greetings need no model or store lookup. Answer immediately so
              // the common first interaction stays near Facebook network speed.
              // Order summary answer (button tap or typed হ্যাঁ/হে/না) — zero AI tokens.
              // Runs before the greeting check so "হে" is never mistaken for "hey".
              {
                const decisionPayload = /^ORDER_(YES|EDIT|NO)$/.exec(qrPayload)?.[1];
                let decision: "yes" | "edit" | "no" | null = decisionPayload
                  ? (decisionPayload.toLowerCase() as "yes" | "edit" | "no")
                  : null;
                if (!decision && (isAffirmative(effectiveText) || isNegative(effectiveText))) {
                  const s = await getConversationPendingOrder(sb, conv!.id);
                  const at = Date.parse(String(s._at ?? ""));
                  const fresh = Number.isFinite(at) && Date.now() - at < 2 * 60 * 60_000;
                  if (fresh && s.product_id && (s.awaiting_confirm || s.hold)) {
                    decision = isAffirmative(effectiveText) ? "yes" : "no";
                  }
                }
                if (decision) {
                  setTraceMeta("route", "fast");
                  setTraceMeta("fast_kind", `order_${decision}`);
                  await handleOrderDecision({ sb, storeId: integ.store_id, conversationId: conv!.id, psid: senderId, token, decision });
                  await markQueuedReply(sb, queuedJobId, `[order ${decision}]`, null);
                  continue;
                }
              }

              if (isGreetingIntent(effectiveText)) {
                const instantReply = /[\u0980-\u09ff]/.test(effectiveText)
                  ? smallTalkReply(effectiveText)
                  : "Hello! How can I help you today?";
                const sent = await fbSend(token, senderId, instantReply);
                await markQueuedReply(sb, queuedJobId, instantReply, sent.message_id);
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "assistant",
                  direction: "out",
                  message_type: "text",
                  content: instantReply,
                  mid: sent.message_id ?? null,
                  delivery_status: "sent",
                });
                await sb
                  .from("ai_conversations")
                  .update({ last_message_at: new Date().toISOString(), last_message_preview: instantReply })
                  .eq("id", conv!.id);
                continue;
              }

              // Deterministic fast path (same as WhatsApp): thanks, generic
              // delivery charges, verified order status — no AI call.
              try {
                const { tryFastPath } = await import("@/lib/fast-path.server");
                const fast = await tryFastPath(sb, {
                  storeId: integ.store_id,
                  conversationId: conv!.id,
                  text: effectiveText,
                  customerPhone: null,
                });
                if (fast) {
                  setTraceMeta("route", "fast");
                  setTraceMeta("fast_kind", fast.kind);
                  const sent = await fbSend(token, senderId, fast.reply);
                  await markQueuedReply(sb, queuedJobId, fast.reply, sent.message_id);
                  await logOutgoingText(sb, conv!.id, fast.reply, sent.message_id ?? null);
                  await sb
                    .from("ai_conversations")
                    .update({ last_message_at: new Date().toISOString(), last_message_preview: fast.reply.slice(0, 200) })
                    .eq("id", conv!.id);
                  continue;
                }
              } catch {
                /* fall through to AI */
              }

              // "আপনাদের কাছে কি আছে?" → this store's top products as cards + a
              // category prompt. Zero AI tokens, store-scoped.
              if (isCatalogBrowseIntent(effectiveText)) {
                try {
                  const done = await sendCatalogBrowseReply({ sb, storeId: integ.store_id, conversationId: conv!.id, psid: senderId, token });
                  if (done) {
                    setTraceMeta("route", "fast");
                    setTraceMeta("fast_kind", "catalog_browse");
                    await markQueuedReply(sb, queuedJobId, "[top products]", null);
                    await sb
                      .from("ai_conversations")
                      .update({ last_message_at: new Date().toISOString(), last_message_preview: "[top products]" })
                      .eq("id", conv!.id);
                    continue;
                  }
                } catch (e) {
                  console.warn("[messenger] catalog browse failed", (e as Error).message);
                }
              }

              // Name-only product message ("মানিব্যাগ", also "টিসার্ট কছে?") → store-scoped
              // catalogue lookup and photo cards (cards show stock), zero AI tokens.
              // Never during checkout: names, sizes, colours and "জি" belong to the order flow.
              const productText = availabilityStripped(effectiveText);
              const orderSlot = isNameOnlyProductQuery(productText)
                ? await getConversationPendingOrder(sb, conv!.id).catch(() => ({ x: 1 }) as Record<string, any>)
                : {};
              // An order left unfinished for 30+ min (or from before timestamps) no
              // longer blocks the zero-token product fast path.
              const slotAt = Date.parse(String((orderSlot as any)?._at ?? ""));
              const orderFresh = Number.isFinite(slotAt) && Date.now() - slotAt < 30 * 60_000;
              const orderInProgress = orderFresh && Object.keys(orderSlot ?? {}).filter((k) => k !== "_at").length > 0;
              if (isNameOnlyProductQuery(productText) && !orderInProgress && !isAffirmative(productText)) {
                try {
                  const hits = await searchDirectProducts(sb, integ.store_id, productText, 6);
                  if (hits.length) {
                    const { data: slugRow } = await sb.from("stores").select("slug").eq("id", integ.store_id).maybeSingle();
                    const done = await maybeSendDirectProductReply({
                      sb,
                      storeId: integ.store_id,
                      storeSlug: (slugRow as any)?.slug ?? null,
                      conversationId: conv!.id,
                      psid: senderId,
                      token,
                      text: productText,
                    });
                    if (done) {
                      setTraceMeta("route", "fast");
                      setTraceMeta("fast_kind", "product_name");
                      await markQueuedReply(sb, queuedJobId, "[product cards]", null);
                      await sb
                        .from("ai_conversations")
                        .update({ last_message_at: new Date().toISOString(), last_message_preview: "[product cards]" })
                        .eq("id", conv!.id);
                      continue;
                    }
                  }
                } catch (e) {
                  console.warn("[messenger] product fast path failed", (e as Error).message);
                }
              }

              // Platform-wide learned wording (3+ stores agreed) → this store's own
              // fresh data, zero AI tokens. Never during an order in progress.
              try {
                const { lookupGlobalIntent } = await import("@/lib/global-phrasebook.server");
                const learned = await lookupGlobalIntent(sb, effectiveText);
                if (learned) {
                  const slot = await getConversationPendingOrder(sb, conv!.id).catch(() => ({ x: 1 }) as Record<string, any>);
                  const busy = Object.keys(slot ?? {}).filter((k) => k !== "_at").length > 0;
                  if (!busy && learned === "catalog_browse") {
                    const done = await sendCatalogBrowseReply({ sb, storeId: integ.store_id, conversationId: conv!.id, psid: senderId, token });
                    if (done) {
                      setTraceMeta("route", "fast");
                      setTraceMeta("fast_kind", "learned_catalog_browse");
                      await markQueuedReply(sb, queuedJobId, "[top products]", null);
                      await sb.from("ai_conversations").update({ last_message_at: new Date().toISOString(), last_message_preview: "[top products]" }).eq("id", conv!.id);
                      continue;
                    }
                  }
                  if (!busy && learned === "delivery_charge") {
                    const { tryFastPath } = await import("@/lib/fast-path.server");
                    const bn = /[\u0980-\u09FF]/.test(effectiveText);
                    const fast = await tryFastPath(sb, { storeId: integ.store_id, conversationId: conv!.id, text: bn ? "ডেলিভারি চার্জ কত" : "delivery charge koto", customerPhone: null });
                    if (fast?.kind === "delivery_charge") {
                      setTraceMeta("route", "fast");
                      setTraceMeta("fast_kind", "learned_delivery_charge");
                      const sent = await fbSend(token, senderId, fast.reply);
                      await markQueuedReply(sb, queuedJobId, fast.reply, sent.message_id);
                      await logOutgoingText(sb, conv!.id, fast.reply, sent.message_id ?? null);
                      await sb.from("ai_conversations").update({ last_message_at: new Date().toISOString(), last_message_preview: fast.reply.slice(0, 200) }).eq("id", conv!.id);
                      continue;
                    }
                  }
                }
              } catch (e) {
                console.warn("[messenger] learned phrase failed", (e as Error).message);
              }

              // Reply pacing is merchant-controlled. Timing starts the moment the
              // customer's message lands, so the AI's own thinking time counts
              // toward the configured delay instead of adding to it.
              const turnStartedAt = Date.now();
              const replyDelaySeconds = Number((integ as any).reply_delay_seconds ?? 0) || 0;
              const replySpeed = String((integ as any).reply_speed ?? "fastest");
              // Instant feedback in Messenger while the model runs.
              void fbTyping(token, senderId).catch(() => {});


              // Merge any order-detail hints into the pending-order slot as CONTEXT for the LLM.
              // This never sends a template — it only short-circuits when the duplicate guard blocks the order.
              const duplicateBlocked = await maybeApplyPendingOrderText({
                sb,
                storeId: integ.store_id,
                conversationId: conv!.id,
                psid: senderId,
                token,
                text: effectiveText,
              });
              if (duplicateBlocked) {
                await sb
                  .from("messenger_integrations")
                  .update({ last_error: null } as any)
                  .eq("id", (integ as any).id);
                continue;
              }

              // Everything the model needs is fetched in ONE parallel round-trip.
              // Previously these six reads ran one after another and dominated the
              // reply latency.
              const useHistory = (integ as any).conversation_history !== false;
              const compact = (integ as any).compact_memory !== false;
              const smallTalk = isSmallTalkIntent(effectiveText);
              const { loadConversationContext, memoryCard, refreshSummary } = await import(
                "./conversation-context.server"
              );
              const [aiCtx, cc, focusRes] = await Promise.all([
                loadAiContext(integ.store_id),
                loadConversationContext(sb, {
                  conversationId: conv!.id,
                  compact,
                  useHistory,
                  latestText: effectiveText,
                }),
                smallTalk
                  ? Promise.resolve({ product: null, ambiguous: false, candidates: [] as any[] })
                  : resolveFocusProduct({
                      storeId: integ.store_id,
                      conversationId: conv!.id,
                      text: effectiveText,
                    }),
              ]);
              const { store, agent, settings } = aiCtx;
              const messages = cc.messages;
              const focus = focusRes as any;
              void replySpeed;

              setTraceMeta("route", "ai");
              const reply = await traceTime("ai", () => generateAgentReply({
                ctx: {
                  storeId: integ.store_id,
                  storeSlug: (store as any).slug,
                  conversationId: conv!.id,
                  psid: senderId,
                  pageToken: token,
                  focusProductId: focus.product?.id ?? null,
                },
                messages,
                system: buildSystemPrompt(store, agent, {
                  channel: "messenger",
                  settings,
                  state: smallTalk
                    ? { pending_order: {}, last_order: null, recent_product_ids: [] }
                    : {
                        pending_order: cc.pending_order,
                        last_order: cc.last_order,
                        recent_product_ids: cc.memory.recent_product_ids ?? [],
                        memory_card: compact ? memoryCard(cc.memory) : null,
                      },
                  focus,
                  latestUserText: effectiveText,
                  customerHistory: customerTexts(messages as any[]),
                }),
                fast: true,
              }));
              if (compact) void refreshSummary(sb, cc, conv!.id);
              if (!smallTalk && !Object.keys(cc.pending_order ?? {}).length && (reply as any)?.toolCalls?.length) {
                void import("@/lib/global-phrasebook.server")
                  .then((m) => m.learnFromAiTurn(sb, { storeId: integ.store_id, text: effectiveText, toolCalls: (reply as any).toolCalls }))
                  .catch(() => {});
              }




              let guardedText = reply?.text ?? "";
              if (reply?.verified && !reply.raw && guardedText.trim()) {
                const { guardReply, logGuardCorrections } = await import("@/lib/reply-guard.server");
                const g = await traceTime("guard", () => guardReply(sb, guardedText, reply.verified, {
                  storeId: (integ as any).store_id,
                  focusProductId: focus?.product?.id ?? null,
                }));
                await logGuardCorrections(sb, conv!.id, g, guardedText);
                guardedText = g.text;
              }
              const replyText = sanitizeOutgoingText(
                sanitizeMessengerReply(guardedText, effectiveText),
                reply?.facts ?? {},
              );
              if (!replyText && !reply?.facts?.hasCard) {
                // Never leave the customer without a reply.
                const fb = focus?.product
                  ? `${(focus.product as any).name} — দাম ৳${(focus.product as any).price}। আর কিছু জানতে চাইলে বলুন 😊`
                  : "দুঃখিত, বুঝতে পারিনি। একটু বিস্তারিত বলবেন? 😊";
                try {
                  const sent = await fbSend(token, senderId, fb);
                  await markQueuedReply(sb, queuedJobId, fb, sent.message_id);
                } catch (e) { console.error("fallback send failed", e); }
                continue;
              }
              if (!replyText) {
                // AI answered by sending a product card/carousel via tool call;
                // nothing more to say. Clear stale errors, don't POST empty text.
                await sb
                  .from("messenger_integrations")
                  .update({ last_error: null } as any)
                  .eq("id", (integ as any).id);
                continue;
              }

              try {
                const sent = await fbSend(token, senderId, replyText);
                await markQueuedReply(sb, queuedJobId, replyText, sent.message_id);
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "assistant",
                  direction: "out",
                  message_type: "text",
                  content: replyText,
                  mid: sent.message_id ?? null,
                  delivery_status: "sent",
                });
                await sb
                  .from("ai_conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: replyText.slice(0, 200),
                  })
                  .eq("id", conv!.id);
                // Clear any previous last_error on successful send.
                await sb
                  .from("messenger_integrations")
                  .update({ last_error: null } as any)
                  .eq("id", (integ as any).id);
              } catch (sendErr) {
                await sb.from("ai_messages").insert({
                  conversation_id: conv!.id,
                  role: "assistant",
                  direction: "out",
                  message_type: "text",
                  content: replyText,
                  delivery_status: "failed",
                  error: (sendErr as Error).message,
                });
                await sb
                  .from("messenger_integrations")
                  .update({
                    last_error: (sendErr as Error).message,
                    delivery_failures: ((integ as any).delivery_failures ?? 0) + 1,
                  } as any)
                  .eq("id", (integ as any).id);
              }

            } catch (e) {
              console.error("messenger handler", e);
              if (queuedJobId) queuedProcessingError = e instanceof Error ? e : new Error("Messenger processing failed");
              await sb
                .from("messenger_integrations")
                .update({ last_error: (e as Error).message } as any)
                .eq("id", (integ as any).id);
            }
          }
        }
        if (queuedProcessingError) return new Response(queuedProcessingError.message, { status: 503 });
        return new Response("ok");
      }
    }
  }
}

/** Internal helpers exposed for automated tests only. */
export const __messengerTestHooks = {
  parseOrderDetailsTextEx,
  maybeApplyPendingOrderText,
};
