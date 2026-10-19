// Phase 2/3: five specialist agents, each with small drawers. Routing is
// deterministic (no AI) and code-registered, so every store — including a
// brand-new merchant — gets it automatically (zero config). Drawers only add
// short focus instructions; all facts still come from store-scoped tools, and
// the persona layer keeps one voice.
import { registerAgent, routeMessage, listAgents, type AgentChannel } from "./registry";

/** Normalise Bengali spelling variants + spacing so typos route the same. */
export function normalizeForRouting(text: string): string {
  return fold((text ?? "").toLowerCase())
    .replace(/[?？!।,.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Patterns get the same letter folding as the text, so either spelling works.
const fold = (s: string) =>
  s.normalize("NFC").replace(/ী/g, "ি").replace(/ূ/g, "ু").replace(/ড়/g, "ড").replace(/য়/g, "য")
    .replace(/ণ/g, "ন").replace(/[ষশ]/g, "স").replace(/[ঁ\u09BC]/g, "");
const has = (re: RegExp) => {
  const folded = new RegExp(fold(re.source), re.flags);
  return (t: string) => folded.test(normalizeForRouting(t));
};

// Patterns are written against normalised text (ী→ি, য়→য, ষ/শ→স, ড়→ড ...).
const GREET = /(^|\s)(hi|hello|hey|helo|salam|slm|assalam|আসসালাম|আস্সালাম|সালাম|হাই|হ্যালো|হেলো|কেমন আছ|কেমন আছেন|kemon ach|kmn ach|kmon as|valo ach|bhalo ach|ভালো আছেন|ধন্যবাদ|thanks|thank you|thx|tnx)/;
const PRODUCT = /(price|prize|dam|daam|দাম|কত টাকা|koto ?tk|koto taka|stock|স্টক|আছে কি|আছে কিনা|ache ?kina|ase ?kina|\bache\b|\base\b|আছে$|(^|\s)(আছে|আসে|কছে|আছ|এছে)($|\s)|size|সাইজ|সাইজে|color|colou?r|কালার|রং|রঙ|variant|ছবি|photo|pic|product|প্রোডাক্ট|পন্য|details|ডিটেইলস)/;
const ORDER = /(order|অর্ডার|অরডার|অডার|কিনব|কিনতে|kinbo|kinte|নিব|নেব|নিতে চাই|nibo|nite chai|buy|confirm|কনফার্ম|কনফাম|ঠিকানা|address|নাম্বার|phone|মোবাইল)/;
const POLICY = /(delivery|deliveri|ডেলিভারি|ডেলিভেরি|দেলিভারি|দেলিব্যারি|ডেলিভারী|charge|চার্জ|ছার্য|চার্য|return|রিটার্ন|exchange|এক্সচেঞ্জ|ফেরত|bkash|বিকাস|nagad|নগদ|payment|পেমেন্ট|\bcod\b|ক্যাস অন|কবে পাব|kobe pabo|koto din|কত দিন|কতদিন)/;
const TRACK = /(track|ট্র্যাক|ট্রাক|status|স্ট্যাটাস|কোথায় আছে|kothay ache|kothay ase|পাইনি|pai ?ni|courier|কুরিয়ার|কুরিযার|parcel|পার্সেল|পার্স্যাল|invoice|#\d+|complain|অভিযোগ|নস্ট|ভাঙা|ভাংগা)/;

export function registerSpecialists(): void {
  if (listAgents().some((a) => a.id === "frontline")) return;

  registerAgent({
    id: "tracking", priority: 50, matches: (i) => has(TRACK)(i.text),
    drawers: [
      { id: "order_status", matches: has(/status|স্ট্যাটাস|invoice|#\d+|কোথায়|কোথায|kothay/), tools: ["getOrderStatus"], instruction: "Look up the customer's own order with the tool; never guess a status." },
      { id: "courier_update", matches: has(/courier|কুরিয়ার|কুরিযার|parcel|পার্সেল|পার্স্যাল|track|ট্র্যাক|ট্রাক/), instruction: "Share courier/tracking info only if the tool returned it." },
      { id: "support_handover", matches: has(/complain|অভিযোগ|নস্ট|ভাঙা|ভাংগা|পাইনি|pai ?ni/), instruction: "Apologise briefly, collect the issue and say the store team will follow up." },
    ],
  });
  registerAgent({
    id: "order", priority: 40, matches: (i) => has(ORDER)(i.text),
    drawers: [
      { id: "slot_collection", matches: () => true, instruction: "Collect name, phone and full address one at a time; never invent them." },
      { id: "order_confirmation", matches: has(/confirm|কনফার্ম|কনফাম|order|অর্ডার|অরডার|অডার/), tools: ["finalizeOrder"], instruction: "Confirm total = items + delivery charge from tools before finalising." },
      { id: "duplicate_guard", matches: has(/আবার|again|another|আরেকটা|arekta/), instruction: "If an existing order is reported, show it instead of creating a new one." },
    ],
  });
  registerAgent({
    id: "policy", priority: 30, matches: (i) => has(POLICY)(i.text),
    drawers: [
      { id: "delivery_charge", matches: has(/deliver|ডেলিভ|দেলিভ|দেলিব|charge|চার্জ|ছার্য|চার্য|কবে পাব|kobe pabo|koto din|কত ?দিন/), tools: ["getDeliveryCharge"], instruction: "Delivery charge/time only from getDeliveryCharge and store policy." },
      { id: "return_policy", matches: has(/return|রিটার্ন|exchange|এক্সচেঞ্জ|ফেরত/), instruction: "State return/exchange rules only from the store policy section." },
      { id: "payment_methods", matches: has(/bkash|বিকাস|nagad|নগদ|payment|পেমেন্ট|\bcod\b|ক্যাস অন/), instruction: "Mention only payment methods the store has enabled." },
    ],
  });
  registerAgent({
    id: "product", priority: 20, matches: (i) => has(PRODUCT)(i.text),
    drawers: [
      { id: "catalog_cards", matches: () => true, tools: ["searchProducts"], instruction: "Search this store only and show matching product cards." },
      { id: "variants", matches: has(/size|সাইজ|color|colou?r|কালার|রং|রঙ|variant/), instruction: "Only offer sizes/colours present in the product's variants." },
      { id: "stock_alternatives", matches: has(/stock|স্টক|আছে|ache|ase|নাই|নেই/), instruction: "If out of stock, suggest an in-stock item from the same store." },
    ],
  });
  registerAgent({
    id: "frontline", priority: 10, matches: () => true,
    drawers: [
      { id: "greetings", matches: has(GREET), instruction: "Greet warmly in one short line and ask how you can help." },
      { id: "message_refiner", matches: (t) => t.length > 120, instruction: "Identify the customer's main need first; answer that only." },
      { id: "store_intro", matches: has(/কি বিক্রি|what do you sell|কি আছে|shop|দোকান|dokan/), instruction: "Briefly describe what this store sells." },
      { id: "unclear", matches: (t) => normalizeForRouting(t).length <= 6, instruction: "If the message is unclear (e.g. 'হুম', 'ok'), reply briefly and ask what they need." },
    ],
  });
}

/** Short prompt section for the chosen specialist + open drawers. Compound
 *  questions ("দাম কত আর ডেলিভারি চার্জ?") also open drawers of other matching
 *  agents so one reply answers every part. */
export function specialistFocus(storeId: string, channel: AgentChannel, text: string): { agentId: string; drawerIds: string[]; secondaryAgents: string[]; prompt: string } {
  registerSpecialists();
  const input = { storeId, channel, text: text ?? "" };
  const r = routeMessage(input);
  if (!r) return { agentId: "frontline", drawerIds: [], secondaryAgents: [], prompt: "" };
  const drawers = [...r.drawers];
  const secondaryAgents: string[] = [];
  for (const a of listAgents()) {
    if (a.id === r.agent.id || a.id === "frontline" || !a.matches(input)) continue;
    secondaryAgents.push(a.id);
    for (const d of a.drawers) if (d.matches(input.text) && !drawers.some((x) => x.id === d.id)) drawers.push(d);
  }
  const lines = drawers.map((d) => d.instruction).filter(Boolean);
  return {
    agentId: r.agent.id,
    drawerIds: drawers.map((d) => d.id),
    secondaryAgents,
    prompt: lines.length ? `# Focus (${r.agent.id} specialist)\n${lines.map((l) => `- ${l}`).join("\n")}` : "",
  };
}

export const _specialistCount = () => (registerSpecialists(), listAgents().length);

// ---- Tool scoping: each agent only gets the tools it needs (every tool
// schema costs prompt tokens on every AI step). ----
// Token budget (target 500–800/turn): only the minimum tools per agent.
// Search results already carry price/stock/variants, so getProduct/checkStock
// and the rarely-used browse tools are not sent; card tools show the product.
const T_SHOW = ["sendProductCard", "sendProductCarousel", "showProduct", "showProducts"];
const T_PRODUCT = ["searchProducts", ...T_SHOW];
const T_ORDER = ["collectOrderInfo", "finalizeOrder"];
const T_POLICY = ["getDeliveryCharge", "getStorePolicy"];
const T_TRACK = ["trackOrder"];
const AGENT_TOOLS: Record<string, string[]> = {
  frontline: [...T_PRODUCT, "collectOrderInfo", "getDeliveryCharge"], // bare product names / name / address replies land here
  product: [...T_PRODUCT],
  order: [...T_ORDER, "getDeliveryCharge", "searchProducts", "sendProductLink"],
  policy: [...T_POLICY],
  tracking: [...T_TRACK],
};
export const _agentToolsForTest = AGENT_TOOLS;

/** Tool names allowed this turn. Pure greetings get no store tools. */
export function allowedToolsFor(text: string, opts: { orderInProgress?: boolean; hasFocus?: boolean } = {}): Set<string> {
  const r = specialistFocus("", "any", text);
  const pureGreeting = r.agentId === "frontline" && r.drawerIds.length > 0 &&
    r.drawerIds.every((d) => d === "greetings" || d === "unclear") && !opts.orderInProgress && !opts.hasFocus;
  const set = new Set<string>(["escalateToHuman"]);
  if (pureGreeting) return set;
  for (const t of AGENT_TOOLS[r.agentId] ?? []) set.add(t);
  // Secondary agents add only their core tools ("কোথায় আছে" must not pull ordering).
  const CORE: Record<string, string[]> = { product: T_PRODUCT, policy: T_POLICY, tracking: T_TRACK, order: T_ORDER };
  for (const id of r.secondaryAgents) {
    if (r.agentId === "tracking" && id === "product") continue;
    for (const t of CORE[id] ?? []) set.add(t);
  }
  if (opts.orderInProgress) for (const t of T_ORDER) set.add(t);
  // The Focus block already holds the product's price/stock/variants.
  if (opts.hasFocus) {
    for (const t of ["sendProductCard", "showProduct"]) set.add(t);
    // Questions about THIS product ("এটার কালার?") need no catalog search;
    // keep search only when the customer asks for another/other products.
    const wantsOther = /অন্য|আর কি পণ্য|আর কোন পণ্য|other product|another|similar|আরো পণ্য|আরও পণ্য/i.test(text);
    if (!wantsOther) for (const t of ["searchProducts", "showProducts", "sendProductCarousel"]) set.delete(t);
  }
  return set;
}
