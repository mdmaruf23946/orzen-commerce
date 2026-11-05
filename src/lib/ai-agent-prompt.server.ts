// AI Commerce Engine — core agent logic used by storefront chat and Messenger webhook.
import { createClient } from "@supabase/supabase-js";
import { generateText, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  sendProductCard as fbSendProductCard,
  sendProductCarousel as fbSendProductCarousel,
  sendViewSiteButton as fbSendViewSiteButton,
  sendQuickReplies as fbSendQuickReplies,
} from "./messenger-send.server";
import { checkDuplicate } from "./duplicate-guard.server";
import { collectVerifiedFacts } from "./reply-guard.server";
import {
  fetchDeliveryZones,
  money,
  orderStatusBn,
  resolveDeliveryCharge,
  shortOrderNo,
} from "./chat-order-format";
import {
  ORDER_FIELD_LABELS,
  messengerPaymentMethods,
  normalizeOrderFlow,
  optionalSlotFields,
  renderConfirmation,
  requiredSlotFields,
  type OrderFieldKey,
} from "./messenger-order-flow";
import { replyStyleInstruction, SHORT_REPLY_RULE } from "./reply-language";
import { deriveCustomerStyle, personaInstruction } from "./agents/customer-style";
import { specialistFocus, allowedToolsFor, stepBudget } from "./agents/specialists";
import { asksForHuman } from "./conversation-guard.server";

import type { AgentContext, GlobalAiSettings, AgentState, FocusProduct } from "./ai-agent-types";
import { formatFocusVariants, BANGLA_SEARCH_SYNONYMS, DEICTIC_TOKENS, PRODUCT_SELECT_MIN, PRODUCT_STOPWORDS, PUBLIC_MESSENGER_ORIGIN, ProductKind, absoluteUrl, blockDuplicateMessengerToolOrder, canonicalCaption, clearConversationSlot, compactSummary, firstImage, getConversationSlot, isBroadBrowseQuery, isMessengerOrderable, isShortFollowUp, loadMessengerPaymentMethods, loadOrderFlow, normalizeCatalogProduct, normalizePhone, productKind, productSummary, productUrl, publicOrigin, resolveFocusProduct, scoreProductAgainstQuery, searchTerms, stringifyProductField, subscriptionBilling, updateConversationSlot, admin } from "./ai-agent-catalog.server";

/** Rules for the routed agent's drawers only — other agents' rules never enter the prompt. */
export function drawerBoundRules(o: {
  text: string;
  orderActive?: boolean;
  hasFocus?: boolean;
  displayTools?: string;
  allowRecommend?: boolean;
}): string[] {
  const r = specialistFocus("", "any", o.text ?? "");
  const agents = new Set([r.agentId, ...r.secondaryAgents]);
  const out = [
    "- Facts (price, stock, delivery charge, policy, product details) come ONLY from this turn's tool results, the Focus block or Store facts. Unverified numbers are auto-removed.",
    "- Short, natural spoken language; never repeat earlier sentences; no technical words. Never type raw URLs. Never promise to send later.",
    "- Misspelled/half-written words: infer the meaning; if genuinely unclear ask one short question.",
  ];
  const productish = agents.has("product") || (r.agentId === "frontline" && !r.drawerIds.every((d) => d === "greetings" || d === "unclear"));
  if (productish || o.hasFocus) {
    out.push(
      o.hasFocus
        ? "- Answer about the Focus product from its block; do not search the catalogue unless asked for other items."
        : "- Product/price/browse intent: call searchProducts immediately; if 0 results retry once with a broader/English term.",
      `- Show products with ${o.displayTools ?? "the card tool"}, plus one short value line. Only say "see below"/👇 when sending a card this turn.`,
      `- Out of stock: say so${o.allowRecommend ? " and offer an in-stock alternative" : ""}.`,
    );
  }
  if (agents.has("policy")) {
    out.push("- Delivery charge: always call getDeliveryCharge. Without an area, list every zone; with an area, give that area's charge first.");
  }
  if (agents.has("order") || o.orderActive) {
    out.push(
      "- A question, greeting or product talk is never a name/address. Save only clearly given details; if unsure, confirm first. Never re-ask known info.",
      "- Customer changes topic: answer the new topic first, resume the order after.",
    );
  }
  return out;
}

export function buildSystemPrompt(
  store: any,
  agent: any,
  opts?: {
    channel?: "web" | "messenger" | "whatsapp";
    settings?: GlobalAiSettings | null;
    state?: AgentState | null;
    focus?: FocusProduct | null;
    latestUserText?: string | null;
    customerHistory?: string[];
  },
) {
  const channel = opts?.channel ?? "messenger";
  const settings = opts?.settings ?? null;
  const state = opts?.state ?? null;
  const focus = opts?.focus ?? null;
  const latestUserText = (opts?.latestUserText ?? "").trim().slice(0, 800);
  const displayTools =
    channel === "web"
      ? "showProducts (multiple) or showProduct (one) — the web chat renders rich cards inline"
      : channel === "whatsapp"
        ? "sendProductCard (one product at a time) so WhatsApp shows the photo, price, stock and a Buy now / View site button"
        : "sendProductCarousel (multiple) or sendProductCard (one) so Messenger shows the image, price, stock and buy button";
  const k = (agent.knowledge ?? {}) as Record<string, any>;
  const supported = (settings?.supported_languages ?? []).filter(Boolean);
  const langHint =
    supported.length > 0
      ? `Only respond in one of these languages: ${supported.join(", ")}. Match the customer's language when possible.`
      : "";
  // Universal persona: one consistent voice from the customer's style memory.
  const lang = opts?.customerHistory
    ? `${personaInstruction(deriveCustomerStyle(opts.customerHistory, latestUserText), { allowEmoji: !!agent.use_emoji })} ${SHORT_REPLY_RULE}`
    : `${replyStyleInstruction(latestUserText)} ${SHORT_REPLY_RULE}`;

  const emoji = agent.use_emoji ? "Use friendly emojis sparingly." : "Do not use emojis.";
  const human = agent.human_like ? "Sound natural and human, not robotic." : "";
  const faqs = Array.isArray(k.faqs)
    ? k.faqs.map((f: any) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")
    : "";

  // ---- Store-admin behaviour toggles (default ON when column is absent) ----
  const on = (v: any) => v !== false;
  const src = (agent.sources ?? {}) as Record<string, any>;
  const srcOn = (key: string) => src[key] !== false;
  const allowRecommend = on(agent.product_recommendations);
  const allowOrders = on(agent.order_assistance);
  const salesFocused = on(agent.sales_focused);
  const allowRelated = allowRecommend && on(agent.recommend_related);
  const askForInfo = on(agent.ask_for_info);
  const allowEscalate = on(agent.escalate_to_human);
  const fallbackMessage = String(agent.fallback_message ?? "").trim();
  const agentDescription = String(agent.description ?? "").trim().slice(0, 200);

  // ---- Admin-configured Buy Now / order collection flow (physical only) ----
  const orderFlow = normalizeOrderFlow(agent.order_flow);
  const requiredKeys = requiredSlotFields(orderFlow).filter((k) => k !== "product_id");
  const optionalKeys = optionalSlotFields(orderFlow);
  const label = (k: string) => ORDER_FIELD_LABELS[k as OrderFieldKey] ?? k;
  const payMethods = messengerPaymentMethods((store as any).payments_config);
  const payLine = payMethods.length
    ? payMethods.map((m) => `${m.label} (${m.id})`).join(", ")
    : "none configured — ask the customer to contact the store for payment";

  const behaviourLines = [
    salesFocused
      ? "- Be sales-focused: highlight benefits, offers and next steps, and gently move the customer toward a purchase — without pressure or exaggeration."
      : "- Be informative and helpful. Do not push the customer to buy.",
    allowRecommend
      ? "- You may suggest products from the store catalogue when they match what the customer needs."
      : "- Do NOT suggest or recommend products. Only answer what the customer explicitly asks about.",
    allowRelated
      ? "- After showing or confirming a product you may offer 2-3 genuinely related items."
      : "- Do NOT offer related or add-on products.",
    askForInfo
      ? "- When information is missing to help (product, quantity, area, budget), ask ONE short specific question at a time."
      : "- Do not interrogate the customer. Answer with what you already know and ask for details only if it is impossible to proceed.",
    allowOrders
      ? "- You may help the customer place and track orders using the order tools."
      : "- Do NOT take orders or collect order details. If the customer wants to buy, point them to the website checkout or the merchant panel.",
    allowEscalate
      ? "- If you cannot help or the customer asks for a human, call escalateToHuman and tell the customer an admin will reply."
      : "- Do not promise a human callback. Ask the customer to contact the store using the store contact details.",
    `- NEVER invent facts. Prices, stock, delivery charges, payment methods, policies, warranty and business hours must come from a tool result or the store facts below.`,
    fallbackMessage
      ? `- If you genuinely do not know something, reply with this fallback message (translate to the customer's language if needed): "${fallbackMessage}"`
      : "- If you genuinely do not know something, say so plainly and suggest contacting the merchant panel.",
  ]
    .filter(Boolean)
    .join("\n");

  const sourceLines = [
    srcOn("products")
      ? "- Products and prices: use the product tools."
      : "- Product catalogue access is OFF: do not discuss specific products or prices.",
    srcOn("stock")
      ? "- Stock/availability: use the stock value from product tool results."
      : "- Stock data is OFF: do not state availability.",
    srcOn("categories") ? "- Categories: use listCategories." : "- Category data is OFF.",
    srcOn("delivery")
      ? "- Delivery charge: ALWAYS call getDeliveryCharge before quoting any charge. Never estimate."
      : "- Delivery data is OFF: do not quote delivery charges or times.",
    "- HARD RULE: any price, total, stock or delivery-charge number in your reply MUST come from a tool result in THIS turn. Replies with unverified numbers are automatically removed before sending.",
    srcOn("payments")
      ? "- Payment methods: use the payment facts below."
      : "- Payment data is OFF: do not list payment methods.",
    srcOn("returns")
      ? "- Return & exchange policy: use the policy below."
      : "- Return policy is OFF: refer the customer to the merchant panel.",
    srcOn("warranty") ? "- Warranty: use the warranty facts below." : "- Warranty data is OFF.",
    srcOn("store_info")
      ? "- Store information: name, address, phone, description below."
      : "- Store info is OFF: share only what the customer already knows.",
    srcOn("business_hours") ? "- Business hours: as listed below." : "- Business hours are OFF.",
  ].join("\n");

  const clip = (v: string, n: number) => (v.length > n ? v.slice(0, n).trimEnd() + "…" : v);
  const globalPrompt = clip((settings?.global_system_prompt ?? "").trim(), 350);
  const brand = clip((settings?.brand_voice ?? "").trim(), 200);
  const safety = clip((settings?.safety_rules ?? "").trim(), 350);
  const globalBlock = [
    globalPrompt ? `# Platform guidance\n${globalPrompt}` : "",
    brand ? `# Brand voice\n${brand}` : "",
    safety ? `# Safety & compliance (never violate)\n${safety}` : "",
    langHint ? `# Language policy\n${langHint}` : "",
    specialistFocus(String(store?.id ?? ""), channel, latestUserText ?? "").prompt,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Compact pending-order block — NO product_name/product_id (that leaks into
  // free-form text as if it were the current focus). The focus block below is
  // the single source of truth for product facts this turn.
  const stateLines: string[] = [];
  const po =
    state?.pending_order && Object.keys(state.pending_order).length ? state.pending_order : null;
  if (po) {
    const parts = [
      po.qty ? `qty=${po.qty}` : null,
      po.customer_name ? `name=${po.customer_name}` : null,
      po.phone ? `phone=${po.phone}` : null,
      po.full_address ? `address=${String(po.full_address).slice(0, 120)}` : null,
      po.payment_method ? `payment=${po.payment_method}` : null,
    ].filter(Boolean);
    if (parts.length)
      stateLines.push(`Pending order slot (already collected): ${parts.join(", ")}`);
  }
  const lo = state?.last_order;
  if (lo?.order_id) {
    stateLines.push(
      `Last confirmed order: #${lo.invoice_no || lo.order_id} — ${lo.product_name ?? "product"} × ${lo.qty ?? 1}`,
    );
  }
  if (state?.memory_card) stateLines.push(clip(String(state.memory_card), 300));
  else if (state?.recent_product_ids?.length)
    stateLines.push(`Products discussed recently (ids): ${state.recent_product_ids.join(", ")}`);
  const stateBlock = stateLines.length ? `# Conversation state\n${stateLines.join("\n")}` : "";
  const latestBlock = latestUserText
    ? `Answer the customer's latest message exactly; older turns are background only.`
    : "";

  // Focus product block — server-resolved for THIS turn only. If set, it is the
  // ONLY product the assistant is allowed to describe/name/price/image in text.
  let focusBlock = "";
  if (focus?.product) {
    const p = focus.product as any;
    const kind = productKind(p);
    const feat = stringifyProductField(p.features).slice(0, 200);
    const varList = formatFocusVariants(p.variants);
    focusBlock = [
      `# Focus product (ONLY product allowed in this reply)`,
      `id: ${p.id}`,
      `name: ${p.name}`,
      `product_type: ${kind}`,
      `purchase_channel: ${kind === "physical" ? "messenger (order allowed here)" : "website only — send the product link, never take an order or payment"}`,
      p.brand ? `brand: ${p.brand}` : "",
      `price: ৳${p.price}${p.old_price ? ` (was ৳${p.old_price})` : ""}`,
      kind === "physical" ? `stock: ${p.stock}` : "",
      p.sku ? `sku: ${p.sku}` : "",
      p.short_description ? `short_description: ${clip(String(p.short_description), 200)}` : "",
      p.description ? `description: ${clip(String(p.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), 350)}` : "",
      stringifyProductField(p.specifications) ? `specifications: ${stringifyProductField(p.specifications).slice(0, 200)}` : "",
      feat ? `features: ${feat}` : "",
      `variants: ${varList || "none — single standard option only; no other colours/sizes exist. Say so directly, do not search."}`,
      ``,
      `Context: the customer's latest message is a follow-up about THIS product even if it does not name it (e.g. "কি ফুলের?", "খাঁটি তো?", "মেয়াদ কত?"). Answer it directly — never ask which product. Use the record first; for general, universally true facts about this kind of product (e.g. honey comes from flower nectar) answer naturally, but never invent store-specific claims (origin, brand, expiry, certification) not in the record — say the store will confirm those.`,
      `Rule: every product fact in your reply MUST come from this record. Do not name, describe, price, or image any other product in this reply. To show it, call ${channel === "web" ? "showProduct" : "sendProductCard"} with productId=${p.id}.`,
    ]
      .filter(Boolean)
      .join("\n");
  } else if (focus?.ambiguous && focus.candidates?.length) {
    const list = focus.candidates
      .slice(0, 4)
      .map((c: any, i: number) => `${i + 1}. ${c.name} — ৳${c.price} (id ${c.id})`)
      .join("\n");
    focusBlock = [
      `# Focus product — AMBIGUOUS`,
      `The customer's message could refer to multiple products:`,
      list,
      ``,
      `Rule: do NOT pick one and describe it. Ask ONE short disambiguation question naming these options. Do not call sendProductCard / showProduct until the customer confirms.`,
    ].join("\n");
  }

  // ---- Compact prompt (Phase 2 prompt diet): one rule per idea, conditional sections ----
  const userLow = latestUserText.toLowerCase();
  const orderActive = !!po || /অর্ডার|order|কিনব|কিনতে|buy|নিব|নেব|confirm|কনফার্ম/i.test(latestUserText);
  const focusKind = focus?.product ? productKind(focus.product) : null;
  const nonPhysicalInPlay =
    (focusKind && focusKind !== "physical") ||
    /digital|service|subscription|ডিজিটাল|সার্ভিস|সাবস্ক্রিপশন|course|কোর্স|ebook/i.test(latestUserText);

  // FAQ: only the (max 3) entries that overlap with the latest message.
  const faqList: Array<{ q: string; a: string }> = Array.isArray(k.faqs) ? k.faqs : [];
  const words = userLow.split(/[\s,.?!।]+/).filter((w) => w.length > 2);
  const pickedFaqs = words.length
    ? faqList
        .map((f) => {
          const hay = `${f.q ?? ""} ${f.a ?? ""}`.toLowerCase();
          return { f, score: words.filter((w) => hay.includes(w)).length };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((x) => `Q: ${x.f.q}\nA: ${clip(String(x.f.a ?? ""), 220)}`)
        .join("\n")
    : "";
  void faqs;

  const policyAsked = /return|ফেরত|রিটার্ন|exchange|এক্সচেঞ্জ|warranty|ওয়ারেন্টি|গ্যারান্টি|payment|পেমেন্ট|বিকাশ|bkash|nagad|নগদ|cod|ক্যাশ|time|সময়|খোলা|hour|ঠিকানা|address|location|কোথায়|phone|নম্বর|delivery|ডেলিভারি|policy|পলিসি/i.test(
    latestUserText,
  );
  // Store facts drawer opens only when the latest message is about store/policy.
  const factLines = [
    policyAsked && srcOn("store_info") && (store.phone || store.address)
      ? `Phone: ${store.phone || "n/a"} | Address: ${store.address || "n/a"}`
      : "",
    (policyAsked || !!po) && srcOn("payments") && k.payment_methods ? `Payment: ${k.payment_methods}` : "",
    ...(policyAsked
      ? [
          srcOn("delivery") && k.delivery_policy ? `Delivery: ${k.delivery_policy}` : "",
          srcOn("returns") && k.return_policy ? `Returns: ${k.return_policy}` : "",
          srcOn("warranty") && k.warranty_policy ? `Warranty: ${k.warranty_policy}` : "",
          srcOn("business_hours") && k.business_hours ? `Hours: ${k.business_hours}` : "",
          srcOn("store_info") && (k.store_info || store.description)
            ? `About: ${String(k.store_info || store.description).slice(0, 400)}`
            : "",
        ]
      : []),
  ].filter(Boolean);

  const orderSection = !allowOrders
    ? `# Orders\nOrdering is off. For buying/tracking send the customer to the website or store contact.`
    : orderActive
      ? `# Order flow (physical only)
Required: ${requiredKeys.map(label).join(", ") || "none"}. Optional (ask once, never block): ${optionalKeys.map(label).join(", ") || "none"}.
Payment methods allowed: ${payLine}.
Ask ${orderFlow.collection_style === "combined" ? "all missing fields in ONE short numbered message" : "ONE missing field per message"}. Save each field with collectOrderInfo; never re-ask collected fields.
When all required fields exist call finalizeOrder and send its confirmation as written. On error "duplicate_blocked" send the returned reply and stop. On "not_orderable_in_messenger" stop and call sendProductLink.
${allowRelated ? "After success you may offer 2-3 add-ons (getRelatedProducts)." : "After success just thank the customer."}
Tracking: call trackOrder (it finds orders from every channel). If it needs a phone, ask for the mobile number used to order.`
      : `# Orders\nPhysical products can be ordered here (collectOrderInfo → finalizeOrder). Order status questions ("order kothay", "kobe asbe"): call trackOrder first; if it returns need=phone, ask for the mobile number used to order; when the customer sends a number, call trackOrder with it.`;

  const typeSection = nonPhysicalInPlay
    ? `# Non-physical products
digital/service/subscription are bought on the website only: never collect order info, confirm purchase, or ask for card/OTP/password. Explain what they get, then call sendProductLink.`
    : `- digital/service/subscription products are website-only: use sendProductLink, never take the order here.`;

  const toggles = [
    salesFocused ? "Be sales-focused but never pushy." : "Be informative; do not push sales.",
    allowRecommend ? (allowRelated ? "You may suggest matching and 2-3 related items." : "You may suggest matching items, no add-ons.") : "Do not recommend products unless asked.",
    askForInfo ? "Ask one short question when info is missing." : "Avoid questioning; ask only if impossible to proceed.",
    allowEscalate ? "If stuck or asked for a human, call escalateToHuman." : "Never promise a human callback.",
    fallbackMessage ? `If you truly don't know, say: "${fallbackMessage}"` : "If you truly don't know, say so plainly.",
  ].join(" ");
  const offSources = [
    !srcOn("products") && "products/prices",
    !srcOn("stock") && "stock",
    !srcOn("delivery") && "delivery charges",
    !srcOn("payments") && "payment methods",
    !srcOn("returns") && "returns",
    !srcOn("warranty") && "warranty",
    !srcOn("business_hours") && "business hours",
  ].filter(Boolean);
  // Frontline greeting turn: no order/product-type sections (old monolithic prompt removed).
  const pureGreetingTurn = !po && !focus?.product && allowedToolsFor(latestUserText).size === 1;
  const rules = drawerBoundRules({
    text: latestUserText,
    orderActive: !!po,
    hasFocus: !!focus?.product,
    displayTools,
    allowRecommend,
  });
  const routed = specialistFocus("", channel, latestUserText);
  const needsOrderSection = !!po || routed.agentId === "order" || routed.agentId === "tracking" ||
    routed.secondaryAgents.includes("order") || routed.secondaryAgents.includes("tracking");

  return `${globalBlock ? globalBlock + "\n\n" : ""}You are ${agent.agent_name}, a warm human-sounding sales assistant for "${store.name}" chatting on ${channel}.
${agentDescription ? `Role: ${agentDescription}\n` : ""}${lang} ${emoji} ${human} Style: ${agent.style}.
${toggles}${offSources.length ? `\nDo not discuss: ${offSources.join(", ")}.` : ""}

# Rules
${rules.join("\n")}
${pureGreetingTurn ? "" : `${nonPhysicalInPlay || routed.agentId !== "frontline" ? typeSection : ""}${needsOrderSection ? `\n\n${orderSection}` : ""}`}

${latestBlock ? latestBlock + "\n\n" : ""}${focusBlock ? focusBlock + "\n\n" : ""}${stateBlock ? stateBlock + "\n\n" : ""}${factLines.length ? `# Store facts\n${factLines.join("\n")}\n\n` : ""}${pickedFaqs ? `# Relevant FAQ\n${pickedFaqs}` : ""}`.trim();
}

