// Extracted from the Messenger webhook; preserve existing channel behaviour.
import { traceTime, setTraceMeta } from "@/lib/telemetry.server";
import { sendQuickReplies } from "@/lib/integrations/messenger-send.server";
import { checkDuplicate } from "@/lib/orders/duplicate-guard.server";
import { normalizeOrderFlow, renderConfirmation, requiredSlotFields, type OrderFlowConfig } from "@/lib/integrations/messenger-order-flow";
import { buildBuyNowMessage, buildMissingFieldsMessage, fetchDeliveryZones, money, orderStatusBn, resolveDeliveryCharge, shortOrderNo, toBnDigits } from "@/lib/orders/chat-order-format";
import { checkPersonName, isAffirmative, isNegative, looksLikeQuestion, sanitizeSlot } from "@/lib/agents/slot-validate";
import { isDeliveryChargeQuestion } from "@/lib/text-normalize";
import { isProductIntent, isOrderIntent, isSmallTalkIntent } from "@/lib/integrations/messenger-intents";
import { normalizePhone, parseOrderDetailsTextEx } from "@/lib/integrations/messenger-order-text";
import { markQueuedReply, logOutgoingText, sendAndLogText, sendAndLogViewSiteButton } from "@/lib/integrations/messenger-transport.server";
import type { MessengerClient } from "@/lib/integrations/messenger-client.server";

export async function getConversationPendingOrder(sb: MessengerClient, conversationId: string) {
  const { data } = await sb
    .from("ai_conversations")
    .select("psid_profile")
    .eq("id", conversationId)
    .maybeSingle();
  const profile = ((data as any)?.psid_profile ?? {}) as Record<string, any>;
  const raw = (profile.pending_order ?? {}) as Record<string, any>;
  // A question/greeting stored earlier as a name or address is dropped here,
  // so it is asked again instead of ending up on an order.
  const { slot, dropped } = sanitizeSlot(raw);
  if (dropped.length) {
    await sb
      .from("ai_conversations")
      .update({ psid_profile: { ...profile, pending_order: slot } } as any)
      .eq("id", conversationId);
  }
  return slot;
}

export async function patchConversationPendingOrder(
  sb: MessengerClient,
  conversationId: string,
  patch: Record<string, any>,
) {
  const { data } = await sb
    .from("ai_conversations")
    .select("psid_profile")
    .eq("id", conversationId)
    .maybeSingle();
  const profile = { ...(((data as any)?.psid_profile ?? {}) as Record<string, any>) };
  profile.pending_order = { ...(profile.pending_order ?? {}), ...patch, _at: new Date().toISOString() };
  await sb.from("ai_conversations").update({ psid_profile: profile } as any).eq("id", conversationId);
  return profile.pending_order as Record<string, any>;
}

export const ORDER_FIELD_BN: Record<string, string> = {
  customer_name: "নাম",
  phone: "ফোন নম্বর",
  district: "জেলা",
  upazila: "থানা/উপজেলা",
  union: "ইউনিয়ন",
  village: "গ্রাম",
  area: "এলাকা",
  full_address: "সম্পূর্ণ ঠিকানা",
  qty: "কতটি লাগবে",
  payment_method: "পেমেন্ট মেথড (COD/bKash/Nagad)",
  note: "অতিরিক্ত নোট",
};

/** Store-admin configured Buy Now flow for this store. */
export async function loadStoreOrderFlow(sb: MessengerClient, storeId: string): Promise<OrderFlowConfig> {
  const { data } = await sb
    .from("store_ai_agents")
    .select("order_flow")
    .eq("store_id", storeId)
    .maybeSingle();
  return normalizeOrderFlow((data as any)?.order_flow);
}

export function orderMissingKeys(slot: Record<string, any>, cfg?: OrderFlowConfig) {
  // Chat orders are always cash on delivery, so the customer is never asked
  // to choose a payment method.
  const keys = requiredSlotFields(cfg ?? normalizeOrderFlow(null)).filter(
    (k) => k !== "product_id" && k !== "payment_method",
  );
  return keys.filter((k) => !slot[k]);
}

export function orderMissingFields(slot: Record<string, any>, cfg?: OrderFlowConfig) {
  return orderMissingKeys(slot, cfg).map((k) => ORDER_FIELD_BN[k] ?? k);
}

export async function replaceConversationProfile(
  sb: MessengerClient,
  conversationId: string,
  updater: (profile: Record<string, any>) => Record<string, any>,
) {
  const { data } = await sb
    .from("ai_conversations")
    .select("psid_profile")
    .eq("id", conversationId)
    .maybeSingle();
  const profile = { ...(((data as any)?.psid_profile ?? {}) as Record<string, any>) };
  const next = updater(profile);
  await sb.from("ai_conversations").update({ psid_profile: next } as any).eq("id", conversationId);
  return next;
}

/** Order summary + হ্যাঁ / পরিবর্তন / না tap buttons. Zero AI tokens. */
export async function sendOrderSummaryForConfirm(opts: {
  sb: MessengerClient;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
  slot: Record<string, any>;
}) {
  const { sb, storeId, conversationId, psid, token, slot } = opts;
  const { data: product } = await sb
    .from("products")
    .select("id,name,price,delivery_charge,variants")
    .eq("store_id", storeId)
    .eq("id", slot.product_id)
    .maybeSingle();
  if (!product) return false;
  const vmod = await import("@/lib/integrations/messenger-variants");
  const vsel = (slot.variant_sel && typeof slot.variant_sel === "object" ? slot.variant_sel : {}) as Record<string, string>;
  const vchosen = vmod.selectedVariant((product as any).variants, vsel);
  const vlabel = vmod.variantLabel(vsel);
  const qty = Math.max(1, Math.min(Number(slot.qty ?? 1) || 1, 99));
  const unit = vchosen?.price != null && vchosen.price > 0 ? vchosen.price : Number(product.price);
  const sub = unit * qty;
  const addressText = [slot.full_address, slot.area, slot.village, slot.union, slot.upazila, slot.district].filter(Boolean).join(", ");
  const zones = await fetchDeliveryZones(sb, storeId);
  const { charge, zone } = resolveDeliveryCharge(addressText, zones, (product as any).delivery_charge);
  await patchConversationPendingOrder(sb, conversationId, { awaiting_confirm: true, hold: null });
  const text = [
    "আপনার অর্ডারের তথ্য:",
    `👤 নাম: ${slot.customer_name}`,
    `📱 মোবাইল: ${slot.phone}`,
    `📍 ঠিকানা: ${slot.full_address}`,
    `📦 পণ্য: ${product.name}${vlabel ? ` (${vlabel})` : ""} × ${toBnDigits(qty)}`,
    `💰 পণ্যের মূল্য: ${money(sub)}`,
    `🚚 ডেলিভারি চার্জ${zone ? ` (${zone.name})` : ""}: ${money(charge)}`,
    `💵 সর্বমোট: ${money(sub + charge)} (ক্যাশ অন ডেলিভারি)`,
    "",
    "তথ্য ঠিক থাকলে অর্ডার কনফার্ম করতে নিচের বাটনে চাপুন 👇",
  ].join("\n");
  try {
    const sent = await sendQuickReplies(token, psid, text, [
      { title: "✅ হ্যাঁ, কনফার্ম", payload: "ORDER_YES" },
      { title: "✏️ তথ্য পরিবর্তন", payload: "ORDER_EDIT" },
      { title: "❌ না, নেব না", payload: "ORDER_NO" },
    ]);
    await logOutgoingText(sb, conversationId, text, (sent as any)?.message_id ?? null);
  } catch (e) {
    await logOutgoingText(sb, conversationId, text, null, (e as Error).message);
    throw e;
  }
  return true;
}

/** Customer answered the summary: yes → pending order, edit → re-ask details, no → hold. */
export async function handleOrderDecision(opts: {
  sb: MessengerClient;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
  decision: "yes" | "edit" | "no";
}) {
  const { sb, storeId, conversationId, psid, token, decision } = opts;
  if (decision === "yes") {
    return finalizePendingMessengerOrder({ sb, storeId, conversationId, psid, token, confirmed: true });
  }
  if (decision === "edit") {
    await patchConversationPendingOrder(sb, conversationId, {
      awaiting_confirm: false,
      customer_name: null,
      phone: null,
      full_address: null,
    });
    await sendAndLogText(sb, token, psid, conversationId, "ঠিক আছে। অনুগ্রহ করে লিখে পাঠান:\n১) আপনার নাম\n২) মোবাইল নম্বর\n৩) সম্পূর্ণ ঠিকানা");
    return true;
  }
  return finalizePendingMessengerOrder({ sb, storeId, conversationId, psid, token, confirmed: true, hold: true });
}

/**
 * Chat lead with a product + phone but no full order yet → shows in
 * All Orders › Incomplete (checkout_drafts, keyed by conversation id).
 */
export async function saveChatIncompleteLead(sb: MessengerClient, storeId: string, conversationId: string, slot: any) {
  try {
    if (!slot?.product_id || !slot?.phone) return;
    const { data: p } = await sb.from("products").select("id,name,price,primary_image_url").eq("store_id", storeId).eq("id", slot.product_id).maybeSingle();
    if (!p) return;
    const vmod = await import("@/lib/integrations/messenger-variants");
    const vsel = (slot.variant_sel && typeof slot.variant_sel === "object" ? slot.variant_sel : {}) as Record<string, string>;
    const qty = Math.max(1, Math.min(Number(slot.qty ?? 1) || 1, 99));
    const price = Number((p as any).price) || 0;
    const { data: existing } = await sb.from("checkout_drafts").select("store_id,converted_order_id").eq("id", conversationId).maybeSingle();
    if (existing && ((existing as any).store_id !== storeId || (existing as any).converted_order_id)) return;
    await sb.from("checkout_drafts").upsert({
      id: conversationId, store_id: storeId,
      customer_name: slot.customer_name ? String(slot.customer_name).slice(0, 120) : null,
      phone: String(slot.phone).slice(0, 40),
      address: slot.full_address ? String(slot.full_address).slice(0, 500) : null,
      items: [{ productId: p.id, name: p.name, qty, price, image: (p as any).primary_image_url ?? undefined, variant: vmod.variantLabel(vsel) || undefined, source: "messenger" }],
      total: price * qty, updated_at: new Date().toISOString(), dismissed: false,
    } as any);
  } catch (e) {
    console.warn("[messenger] incomplete lead save failed", (e as Error).message);
  }
}

export async function finalizePendingMessengerOrder(opts: {
  sb: MessengerClient;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
  /** Only an explicit হ্যাঁ to the summary creates the (pending) order. */
  confirmed?: boolean;
  /** Customer declined the full summary → order saved as On Hold. */
  hold?: boolean;
}) {
  const { sb, storeId, conversationId, psid, token } = opts;
  const slot = await getConversationPendingOrder(sb, conversationId);
  const flowCfg = await loadStoreOrderFlow(sb, storeId);
  const missing = orderMissingFields(slot, flowCfg);
  if (!slot.product_id) missing.unshift("প্রোডাক্ট");
  if (missing.length) {
    if (opts.hold) {
      await sendAndLogText(sb, token, psid, conversationId, "ঠিক আছে। পরে নিতে চাইলে আবার Buy Now চাপুন বা জানান।");
      return true;
    }
    await saveChatIncompleteLead(sb, storeId, conversationId, slot);
    await sendAndLogText(sb, token, psid, conversationId, buildMissingFieldsMessage(missing));
    return true;
  }
  if (!opts.confirmed) {
    const vmod0 = await import("@/lib/integrations/messenger-variants");
    const { data: vp } = await sb.from("products").select("id,name,variants").eq("store_id", storeId).eq("id", slot.product_id).maybeSingle();
    const vsel0 = (slot.variant_sel && typeof slot.variant_sel === "object" ? slot.variant_sel : {}) as Record<string, string>;
    if (vp && vmod0.nextVariantStep((vp as any).variants, vsel0)) {
      await sendNextVariantStep(sb, token, psid, conversationId, vp as any, vsel0);
      return true;
    }
    if (await sendOrderSummaryForConfirm({ sb, storeId, conversationId, psid, token, slot })) return true;
  }

  const qty = Math.max(1, Math.min(Number(slot.qty ?? 1) || 1, 99));
  const { data: product } = await sb
    .from("products")
    .select("id,name,price,stock,status,delivery_charge,variants")
    .eq("store_id", storeId)
    .eq("id", slot.product_id)
    .maybeSingle();

  if (!product || product.status !== "active") {
    await sendAndLogText(sb, token, psid, conversationId, "দুঃখিত, এই প্রোডাক্টটি এখন অর্ডারের জন্য পাওয়া যাচ্ছে না। অন্য প্রোডাক্ট চাইলে নাম লিখুন।");
    return true;
  }
  if (Number(product.stock) < qty) {
    await sendAndLogText(sb, token, psid, conversationId, `দুঃখিত, ${product.name} এর স্টক এখন ${Number(product.stock)}টি। কম quantity চাইলে বলুন, আমি অর্ডার করে দিচ্ছি।`);
    return true;
  }

  const blocked = await maybeBlockDuplicateMessengerOrder({
    sb,
    storeId,
    conversationId,
    psid,
    token,
    slot,
    product: { id: product.id, name: product.name },
  });
  if (blocked) return true;

  const vmod = await import("@/lib/integrations/messenger-variants");
  const vsel = (slot.variant_sel && typeof slot.variant_sel === "object" ? slot.variant_sel : {}) as Record<string, string>;
  if (vmod.nextVariantStep((product as any).variants, vsel)) {
    await sendNextVariantStep(sb, token, psid, conversationId, product as any, vsel);
    return true;
  }
  const vchosen = vmod.selectedVariant((product as any).variants, vsel);
  const vlabel = vmod.variantLabel(vsel);
  if (vchosen?.stock != null && vchosen.stock < qty) {
    await sendAndLogText(sb, token, psid, conversationId, `দুঃখিত, ${product.name} (${vlabel}) এর স্টক এখন ${vchosen.stock}টি। অন্য অপশন নিতে আবার Buy Now চাপুন।`);
    return true;
  }
  const unitPrice = vchosen?.price != null && vchosen.price > 0 ? vchosen.price : Number(product.price);
  const itemName = vlabel ? `${product.name} (${vlabel})` : product.name;
  const subtotal = unitPrice * qty;
  const addressText = [slot.full_address, slot.area, slot.village, slot.union, slot.upazila, slot.district]
    .filter(Boolean)
    .join(", ");
  const zones = await fetchDeliveryZones(sb, storeId);
  const { charge: delivery, zone } = resolveDeliveryCharge(
    addressText,
    zones,
    (product as any).delivery_charge,
  );
  const total = subtotal + delivery;
  const phoneClean = normalizePhone(slot.phone) ?? String(slot.phone).trim();
  const { buildIdempotencyKey, createChatOrder } = await import("@/lib/orders/chat-order.server");
  const created = await createChatOrder(
    sb,
    storeId,
    buildIdempotencyKey({ channel: "messenger", conversationId, productId: product.id, variant: vlabel || null, qty, phone: phoneClean }),
    {
      customer_name: String(slot.customer_name).trim(),
      phone: phoneClean,
      email: slot.email ? String(slot.email).trim() : null,
      address: String(slot.full_address).trim(),
      area:
        [slot.village, slot.union, slot.upazila, slot.district].filter(Boolean).join(", ") ||
        zone?.name ||
        null,
      payment_method: "cod",
      subtotal: total,
      delivery_amount: delivery,
      delivery_zone_id: zone?.id ?? null,
      discount_amount: 0,
      notes: slot.note
        ? `Placed via Messenger AI Sales Agent — ${String(slot.note).slice(0, 300)}`
        : "Placed via Messenger AI Sales Agent",
    },
    [{ product_id: product.id, name: itemName, price: unitPrice, qty }],
  );

  if (!created.ok && created.error === "out_of_stock") {
    const left = Number((created as any).available) || 0;
    await sendAndLogText(sb, token, psid, conversationId, left <= 0
      ? `দুঃখিত, ${product.name} এর শেষ স্টকটি এইমাত্র বিক্রি হয়ে গেছে। অন্য কোনো প্রোডাক্ট দেখতে চাইলে বলুন।`
      : `দুঃখিত, ${product.name} এর স্টক এখন ${left}টি। কম quantity চাইলে বলুন।`);
    return true;
  }
  if (!created.ok) {
    const errorText = created.error ?? "Order failed";
    await sendAndLogText(sb, token, psid, conversationId, "দুঃখিত, অর্ডারটি কনফার্ম করতে সমস্যা হয়েছে। আমাদের টিম একটু পর দেখে জানাবে।");
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "system",
      direction: "out",
      message_type: "text",
      content: "[order create failed]",
      delivery_status: "failed",
      error: errorText,
    } as any);
    throw new Error(errorText);
  }
  const order = { id: created.id, invoice_no: created.invoice_no };
  // The chat lead is now a real order — drop it from the Incomplete list.
  await sb.from("checkout_drafts").update({ converted_order_id: order.id } as any)
    .eq("id", conversationId).eq("store_id", storeId);
  if (opts.hold) {
    // Customer said "না" after giving every detail → All Orders › On Hold.
    await sb.from("orders").update({ followup_status: "on_hold", status_source: "chat" } as any)
      .eq("id", order.id).eq("store_id", storeId).eq("status", "pending");
    await patchConversationPendingOrder(sb, conversationId, { awaiting_confirm: false, hold: new Date().toISOString() });
    await sb.from("ai_conversations").update({ lead_status: "hold" } as any).eq("id", conversationId);
    await sendAndLogText(sb, token, psid, conversationId, "ঠিক আছে, অর্ডারটি আপাতত হোল্ডে রাখা হলো। পরে নিতে চাইলে \"হ্যাঁ\" লিখুন।");
    return true;
  }
  if (created.existing) {
    // Same order put on hold earlier and now confirmed → back to Pending.
    const { data: moved } = await sb.from("orders").update({ followup_status: null, status_source: "chat" } as any)
      .eq("id", order.id).eq("store_id", storeId).eq("status", "pending").eq("followup_status", "on_hold").select("id");
    if (moved?.length) {
      await sb.from("ai_conversations").update({ lead_status: "ordered" } as any).eq("id", conversationId);
      await replaceConversationProfile(sb, conversationId, (profile) => { delete profile.pending_order; return profile; });
      await sendAndLogText(sb, token, psid, conversationId, `ধন্যবাদ! আপনার অর্ডার #${shortOrderNo(order.invoice_no, order.id)} কনফার্ম করা হলো। শীঘ্রই আমাদের টিম যোগাযোগ করবে।`);
      return true;
    }
    await sendAndLogText(sb, token, psid, conversationId, `আপনার অর্ডার #${shortOrderNo(order.invoice_no, order.id)} আগেই নেওয়া হয়েছে। নতুন করে কিছু করতে হবে না।`);
    return true;
  }

  await Promise.all([
    sb.from("order_timeline").insert({ store_id: storeId, order_id: order.id, stage: "placed", note: "Order placed via Messenger AI" } as any),
    sb.from("admin_notifications").insert({
      store_id: storeId,
      kind: "new_order",
      title: "New Messenger AI order",
      body: `${slot.customer_name} ordered ${qty}× ${product.name}`,
      meta: { order_id: order.id, conversation_id: conversationId },
    } as any),
    sb.from("ai_conversations").update({
      phone: normalizePhone(slot.phone) ?? String(slot.phone).trim(),
      address: String(slot.full_address).trim(),
      lead_status: "ordered",
    } as any).eq("id", conversationId),
    // The inbox shows the customer's real Facebook name; only use the typed
    // order name when Facebook gave us nothing.
    sb.from("ai_conversations").update({
      customer_name: String(slot.customer_name).trim(),
    } as any).eq("id", conversationId).is("customer_name", null),
  ]);

  await replaceConversationProfile(sb, conversationId, (profile) => {
    delete profile.pending_order;
    return {
      ...profile,
      last_order: {
        order_id: order.id,
        invoice_no: order.invoice_no,
        product_id: product.id,
        product_name: product.name,
        qty,
        total,
        created_at: new Date().toISOString(),
      },
    };
  });

  const template = String(flowCfg.confirmation_message ?? "");
  const uses = (key: string) => new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "i").test(template);
  const lines = [
    renderConfirmation(template, {
      product: product.name,
      qty,
      total: money(total),
      customer_name: slot.customer_name,
      address: slot.full_address,
      payment_method: "ক্যাশ অন ডেলিভারি",
      invoice_no: shortOrderNo(order.invoice_no, order.id),
    }),
  ];
  // Only add the summary lines the admin's own template doesn't already cover.
  lines.push("────────────────");
  if (!uses("invoice_no")) lines.push(`অর্ডার নম্বর: ${shortOrderNo(order.invoice_no, order.id)}`);
  if (!uses("product") && !uses("qty")) lines.push(`প্রোডাক্ট: ${product.name} × ${toBnDigits(qty)}`);
  lines.push(`পণ্যের মূল্য: ${money(subtotal)}`);
  lines.push(`ডেলিভারি চার্জ${zone ? ` (${zone.name})` : ""}: ${money(delivery)}`);
  if (!uses("total")) lines.push(`সর্বমোট: ${money(total)}`);
  if (!uses("payment_method")) lines.push("পেমেন্ট: ক্যাশ অন ডেলিভারি");
  const confirmation = lines.filter(Boolean).join("\n");
  await sendAndLogText(sb, token, psid, conversationId, confirmation);
  return true;
}

export async function maybeBlockDuplicateMessengerOrder(opts: {
  sb: MessengerClient;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
  slot: Record<string, any>;
  product: { id: string; name?: string | null };
}) {
  const { sb, storeId, conversationId, psid, token, slot, product } = opts;
  if (!product.id) return false;

  const { data: dpSettings } = await sb
    .from("store_duplicate_protection")
    .select("messenger_enabled, messenger_custom_reply")
    .eq("store_id", storeId)
    .maybeSingle();
  if (dpSettings && (dpSettings as any).messenger_enabled === false) return false;

  const normalizedPhone = normalizePhone(slot.phone) ?? String(slot.phone ?? "").trim();
  const dup = await checkDuplicate({
    storeId,
    phone: normalizedPhone || null,
    customerId: null,
    fingerprint: null,
    deviceId: null,
    productIds: [product.id],
    psid,
  });
  if (dup.action === "allow") return false;

  const invoice = shortOrderNo(dup.matchedOrder?.invoice_no, dup.matchedOrder?.id);
  const status = orderStatusBn(dup.matchedOrder?.status);
  const defaultReply = [
    "আপনার এই পণ্যের একটি অর্ডার ইতোমধ্যে রয়েছে।",
    `অর্ডার নম্বর: #${invoice}`,
    `স্ট্যাটাস: ${status}`,
    "একই পণ্যের জন্য নতুন অর্ডার দেওয়ার আগে বর্তমান অর্ডারটি সম্পন্ন অথবা বাতিল হওয়া প্রয়োজন।",
    "আপনার কি বর্তমান অর্ডারের স্ট্যাটাস জানতে চান?",
  ].join("\n");
  const reply = ((dpSettings as any)?.messenger_custom_reply as string | null) || defaultReply;

  await sb.from("store_duplicate_blocks").insert({
    store_id: storeId,
    phone: normalizedPhone || null,
    matched_rules: dup.matchedRules,
    matched_order_id: dup.matchedOrderId,
    status: "blocked",
    source: "messenger",
    psid,
    product_ids: [product.id],
    payload: {
      customerName: slot.customer_name,
      address: slot.full_address,
      productId: product.id,
      productName: product.name,
      qty: Math.max(1, Math.min(Number(slot.qty ?? 1) || 1, 99)),
      reason: "Duplicate Order Attempt",
    },
  } as any);

  await sendAndLogText(sb, token, psid, conversationId, reply);
  await replaceConversationProfile(sb, conversationId, (profile) => {
    delete profile.pending_order;
    return profile;
  });
  return true;
}

export function isChitchatOrProductTalk(text: string) {
  const c = checkPersonName(text);
  return !c.ok && (c.reason === "chitchat" || c.reason === "product_talk");
}

export const FIELD_ASK_BN: Record<string, string> = {
  customer_name: "নাম",
  full_address: "সম্পূর্ণ ঠিকানা",
  phone: "মোবাইল নম্বর",
};

/** Did the customer ask about the delivery charge in the last few messages? */
export async function recentlyAskedDeliveryCharge(sb: MessengerClient, conversationId: string) {
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data } = await sb
    .from("ai_messages")
    .select("content,role")
    .eq("conversation_id", conversationId)
    .eq("role", "user")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  return ((data ?? []) as any[]).some((m) => isDeliveryChargeQuestion(String(m.content ?? "")));
}

export async function maybeApplyPendingOrderText(opts: {
  sb: MessengerClient;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
  text: string;
}) {
  // Merge order details from this message into the pending-order slot (so the
  // LLM sees them), confirm unclear values with the customer, and short-circuit
  // for duplicates / complete orders. Returns true when a reply was sent.
  const { sb, storeId, conversationId, psid, token, text } = opts;
  let current = await getConversationPendingOrder(sb, conversationId);
  const cfg = await loadStoreOrderFlow(sb, storeId);
  const missingBefore = current.product_id ? orderMissingKeys(current, cfg) : [];

  const askMissing = async (slot: Record<string, any>) => {
    if (!slot.product_id) return false;
    const missing = orderMissingFields(slot, cfg);
    if (!missing.length) return finalizePendingMessengerOrder({ sb, storeId, conversationId, psid, token });
    await sendAndLogText(sb, token, psid, conversationId, buildMissingFieldsMessage(missing));
    return true;
  };

  // 1) We asked "আপনার নাম কি …?" last time — handle the yes / no answer.
  const pendingConfirm = current.confirm as { field?: string; value?: string } | null | undefined;
  if (pendingConfirm?.field) {
    if (isAffirmative(text) && pendingConfirm.value) {
      const slot = await patchConversationPendingOrder(sb, conversationId, {
        [pendingConfirm.field]: pendingConfirm.value,
        confirm: null,
      });
      return askMissing(slot);
    }
    current = await patchConversationPendingOrder(sb, conversationId, { confirm: null });
    if (isNegative(text)) {
      const label = FIELD_ASK_BN[pendingConfirm.field] ?? "তথ্য";
      await sendAndLogText(sb, token, psid, conversationId, `ঠিক আছে, আপনার সঠিক ${label} লিখে পাঠান।`);
      return true;
    }
  }

  const { patch: details, leftover } = parseOrderDetailsTextEx(text, {
    awaitingName: missingBefore.includes("customer_name"),
    awaitingAddress: missingBefore.includes("full_address"),
  });

  // 2) Waiting for details but the rules could not place the text (half-written,
  //    misspelt, unusual) → a small AI step reads it. Unsure → ask, never guess.
  const stillMissing = missingBefore.filter((k) => !details[k]);
  const canUnderstand =
    leftover &&
    leftover.length <= 200 &&
    stillMissing.some((k) => k === "customer_name" || k === "full_address") &&
    !looksLikeQuestion(leftover) &&
    !isOrderIntent(leftover) &&
    !isSmallTalkIntent(leftover) &&
    !isProductIntent(leftover) &&
    !isChitchatOrProductTalk(leftover);
  if (canUnderstand) {
    const { understandOrderReply } = await import("@/lib/orders/order-understand.server");
    const u = await traceTime("understand", () => understandOrderReply(leftover, stillMissing));
    setTraceMeta("understand", u ? `${u.kind}:${u.confidence}` : "none");
    if (u && u.kind !== "question" && u.kind !== "other") {
      const cand: Record<string, string> = {};
      if (u.name && stillMissing.includes("customer_name")) cand.customer_name = u.name;
      if (u.address && stillMissing.includes("full_address")) cand.full_address = u.address;
      if (u.phone && !details.phone && stillMissing.includes("phone")) {
        const p = normalizePhone(u.phone);
        if (p) cand.phone = p;
      }
      const entries = Object.entries(cand);
      if (entries.length && u.confidence >= 0.8) {
        Object.assign(details, cand);
      } else if (entries.length && u.confidence >= 0.4) {
        const firstEntry = entries[0];
        if (!firstEntry) return false;
        const [field, value] = firstEntry;
        await patchConversationPendingOrder(sb, conversationId, { ...details, confirm: { field, value } });
        const q =
          field === "customer_name"
            ? `আপনার নাম কি "${value}"? ঠিক থাকলে "হ্যাঁ" লিখুন, না হলে সঠিক নামটা লিখে দিন।`
            : field === "full_address"
            ? `আপনার ঠিকানা কি "${value}"? ঠিক থাকলে "হ্যাঁ" লিখুন, না হলে সঠিক ঠিকানা লিখে দিন।`
            : `আপনার মোবাইল নম্বর কি ${value}? ঠিক থাকলে "হ্যাঁ" লিখুন।`;
        await sendAndLogText(sb, token, psid, conversationId, q);
        return true;
      }
    }
    if (!Object.keys(details).length && (!u || (u.kind !== "question" && u.confidence < 0.4))) {
      const label = (FIELD_ASK_BN[stillMissing.find((k) => FIELD_ASK_BN[k]) ?? "customer_name"] ?? "নাম");
      await sendAndLogText(
        sb,
        token,
        psid,
        conversationId,
        `দুঃখিত, ঠিক বুঝতে পারিনি। আপনি কি আপনার ${label} লিখেছেন? অনুগ্রহ করে শুধু আপনার ${label} লিখে পাঠান।`,
      );
      return true;
    }
  }

  const hasNewOrderDetails = Object.keys(details).length > 0;

  // 3) Asked the delivery charge earlier, now sent an address (no product yet)
  //    → answer with that area's real charge instead of changing the topic.
  if (!current.product_id && details.full_address && !details.phone) {
    if (await recentlyAskedDeliveryCharge(sb, conversationId)) {
      const zones = await fetchDeliveryZones(sb, storeId);
      const { charge, zone } = resolveDeliveryCharge(details.full_address, zones, null);
      if (zone) {
        await patchConversationPendingOrder(sb, conversationId, { ...current, ...details });
        await sendAndLogText(
          sb,
          token,
          psid,
          conversationId,
          `আপনার এলাকায় (${zone.name}) ডেলিভারি চার্জ ${money(charge)}।\nকোন পণ্যটি নিতে চান? নাম লিখুন বা ছবি পাঠান।`,
        );
        return true;
      }
    }
  }

  if (!hasNewOrderDetails && !isOrderIntent(text)) return false;
  const slot = hasNewOrderDetails
    ? await patchConversationPendingOrder(sb, conversationId, { ...current, ...details })
    : current;
  if (!slot.product_id) return false;
  // Customer just sent the details after Buy Now and nothing is missing:
  // create the order and send the confirmation directly (no AI round-trip,
  // which could time out and leave the customer without any reply).
  if (hasNewOrderDetails) {
    const missing = orderMissingFields(slot, cfg);
    if (!missing.length) {
      return finalizePendingMessengerOrder({ sb, storeId, conversationId, psid, token });
    }
  }
  const blocked = await maybeBlockDuplicateMessengerOrder({
    sb,
    storeId,
    conversationId,
    psid,
    token,
    slot,
    product: { id: String(slot.product_id), name: slot.product_name ?? null },
  });
  return blocked; // true = duplicate short-circuit already replied; false = fall through to LLM
}

/** Ask the next variant (Color → Size …) as tap buttons. Returns false when all are chosen. */
export async function sendNextVariantStep(
  sb: MessengerClient,
  token: string,
  psid: string,
  conversationId: string,
  product: { id: string; name: string; variants?: unknown },
  sel: Record<string, string>,
) {
  const { nextVariantStep, optionLabelBn, variantPayload, variantLabel } = await import("@/lib/integrations/messenger-variants");
  const step = nextVariantStep(product.variants, sel);
  if (!step) return false;
  const label = optionLabelBn(step.name);
  if (!step.values.length) {
    await sendAndLogText(sb, token, psid, conversationId, `দুঃখিত, ${product.name}${Object.keys(sel).length ? ` (${variantLabel(sel)})` : ""} এর কোনো ${label} এখন স্টকে নেই। অন্য অপশন বেছে নিতে আবার Buy Now চাপুন।`);
    return true;
  }
  const picked = Object.keys(sel).length ? `✅ ${variantLabel(sel)}\n` : "";
  const text = `${picked}${product.name} — আপনার পছন্দের ${label} বেছে নিন 👇`;
  try {
    const sent = await sendQuickReplies(
      token,
      psid,
      text,
      step.values.slice(0, 13).map((v) => ({ title: v, payload: variantPayload(product.id, step.name, v) })),
    );
    await logOutgoingText(sb, conversationId, text, (sent as any)?.message_id ?? null);
  } catch (e) {
    await logOutgoingText(sb, conversationId, text, null, (e as Error).message);
    throw e;
  }
  return true;
}

export async function handleBuyPostback(opts: {
  sb: MessengerClient;
  storeId: string;
  conversationId: string;
  psid: string;
  token: string;
  payload: string;
  queuedJobId?: string | null;
}) {
  const { sb, storeId, conversationId, psid, token, payload } = opts;
  const queuedJobId = opts.queuedJobId ?? null;
  const { parseVariantPayload, selectedVariant, variantLabel, nextVariantStep } = await import("@/lib/integrations/messenger-variants");
  const varPick = parseVariantPayload(payload);
  const productId = varPick ? varPick.productId : payload.replace(/^BUY_/, "");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return false;
  const { data: product } = await sb
    .from("products")
    .select("id,name,slug,price,stock,status,product_type,delivery_charge,variants")
    .eq("store_id", storeId)
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.status !== "active") {
    const miss = "দুঃখিত, এই প্রোডাক্টটি এখন পাওয়া যাচ্ছে না। চাইলে কাছাকাছি অন্য প্রোডাক্ট দেখাতে পারি।";
    await sendAndLogText(sb, token, psid, conversationId, miss);
    await markQueuedReply(sb, queuedJobId, miss, null);
    return true;
  }
  // Only physical products can be ordered inside Messenger.
  if (String((product as any).product_type ?? "physical") !== "physical") {
    const { data: store } = await sb.from("stores").select("slug").eq("id", storeId).maybeSingle();
    const origin = (process.env["PUBLIC_APP_URL"] || process.env["VITE_APP_URL"] || "https://orzen-commerce.lovable.app").replace(/\/$/, "");
    const url = store?.slug ? `${origin}/store/${store.slug}/product/${product.id}` : `${origin}/product/${product.id}`;
    const webText = "এই প্রোডাক্টটি আমাদের ওয়েবসাইট থেকে নিরাপদে কিনতে পারবেন";
    await sendAndLogViewSiteButton(sb, token, psid, conversationId, webText, url);
    await markQueuedReply(sb, queuedJobId, webText, null);
    return true;
  }
  if (Number(product.stock) <= 0) {
    const oos = "দুঃখিত, এই প্রোডাক্টটি এখন স্টকে নেই। চাইলে কাছাকাছি অন্য প্রোডাক্ট দেখাতে পারি।";
    await sendAndLogText(sb, token, psid, conversationId, oos);
    await markQueuedReply(sb, queuedJobId, oos, null);
    return true;
  }

  const current = await getConversationPendingOrder(sb, conversationId);
  // A fresh Buy Now always restarts the picker; a variant tap adds to the
  // picks for the same product only (stale buttons of another product reset).
  const prevSel =
    varPick && current.product_id === product.id && current.variant_sel && typeof current.variant_sel === "object"
      ? (current.variant_sel as Record<string, string>)
      : {};
  const sel: Record<string, string> = varPick ? { ...prevSel, [varPick.name]: varPick.value } : {};
  const slot = await patchConversationPendingOrder(sb, conversationId, {
    ...current,
    product_id: product.id,
    variant_sel: sel,
    qty: current.qty ?? 1,
  });
  if (await sendNextVariantStep(sb, token, psid, conversationId, product as any, sel)) {
    await markQueuedReply(sb, queuedJobId, `[variant step] ${variantLabel(sel)}`, null);
    return true;
  }
  const hasVariants = nextVariantStep((product as any).variants, {}) !== null;
  const chosen = hasVariants ? selectedVariant((product as any).variants, sel) : null;
  const price = chosen?.price != null && chosen.price > 0 ? chosen.price : Number((product as any).price ?? 0);
  const label = variantLabel(sel);
  const displayName = label ? `${product.name} (${label})` : product.name;
  const cfg = await loadStoreOrderFlow(sb, storeId);
  const missing = orderMissingFields(slot, cfg);
  if (!missing.length) {
    // Known name/phone/address → show them with হ্যাঁ / পরিবর্তন / না buttons.
    await sendOrderSummaryForConfirm({ sb, storeId, conversationId, psid, token, slot });
    await markQueuedReply(sb, queuedJobId, "[order summary]", null);
    return true;
  }
  const zones = await fetchDeliveryZones(sb, storeId);
  const reply = buildBuyNowMessage({
    productName: displayName,
    price,
    qty: Number(slot.qty ?? 1) || 1,
    zones,
    productDeliveryCharge: (product as any).delivery_charge,
    intro: cfg.buy_now_message,
    missing,
    known: slot,
  });
  await patchConversationPendingOrder(sb, conversationId, { awaiting_confirm: false });
  await saveChatIncompleteLead(sb, storeId, conversationId, slot);
  await sendAndLogText(sb, token, psid, conversationId, reply);
  await markQueuedReply(sb, queuedJobId, reply, null);
  return true;
}
