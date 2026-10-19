// Phase 2: five specialist agents, each with small drawers. Routing is
// deterministic (no AI). Drawers only add short focus instructions; all facts
// still come from store-scoped tools, and the persona layer keeps one voice.
import { registerAgent, routeMessage, listAgents, type AgentChannel } from "./registry";

const has = (re: RegExp) => (t: string) => re.test(t.toLowerCase());

const GREET = /(^|\s)(hi|hello|hey|salam|assalam|সালাম|আসসালামু|হাই|হ্যালো|কেমন আছ|ধন্যবাদ|thanks|thank you)/;
const PRODUCT = /(price|dam|দাম|কত টাকা|stock|স্টক|আছে\?|size|সাইজ|color|colou?r|কালার|রং|variant|ছবি|photo|pic|product|প্রোডাক্ট|পণ্য)/;
const ORDER = /(order|অর্ডার|কিনব|নিব|নেব|buy|confirm|কনফার্ম|ঠিকানা|address|নাম্বার|phone|মোবাইল)/;
const POLICY = /(delivery|ডেলিভারি|charge|চার্জ|return|রিটার্ন|exchange|এক্সচেঞ্জ|ফেরত|bkash|বিকাশ|nagad|নগদ|payment|পেমেন্ট|cod|ক্যাশ অন)/;
const TRACK = /(track|ট্র্যাক|status|স্ট্যাটাস|কোথায়|কবে পাব|পাইনি|courier|কুরিয়ার|parcel|পার্সেল|invoice|#\d+|complain|অভিযোগ|নষ্ট|ভাঙা)/;

let registered = false;
export function registerSpecialists(): void {
  if (registered) return;
  registered = true;

  registerAgent({
    id: "tracking", priority: 50, matches: (i) => has(TRACK)(i.text),
    drawers: [
      { id: "order_status", matches: has(/status|স্ট্যাটাস|invoice|#\d+|কবে পাব|কোথায়/), tools: ["getOrderStatus"], instruction: "Look up the customer's own order with the tool; never guess a status." },
      { id: "courier_update", matches: has(/courier|কুরিয়ার|parcel|পার্সেল|track|ট্র্যাক/), instruction: "Share courier/tracking info only if the tool returned it." },
      { id: "support_handover", matches: has(/complain|অভিযোগ|নষ্ট|ভাঙা|পাইনি/), instruction: "Apologise briefly, collect the issue and say the store team will follow up." },
    ],
  });
  registerAgent({
    id: "order", priority: 40, matches: (i) => has(ORDER)(i.text),
    drawers: [
      { id: "slot_collection", matches: () => true, instruction: "Collect name, phone and full address one at a time; never invent them." },
      { id: "order_confirmation", matches: has(/confirm|কনফার্ম|order|অর্ডার/), tools: ["finalizeOrder"], instruction: "Confirm total = items + delivery charge from tools before finalising." },
      { id: "duplicate_guard", matches: has(/আবার|again|another|আরেকটা/), instruction: "If an existing order is reported, show it instead of creating a new one." },
    ],
  });
  registerAgent({
    id: "policy", priority: 30, matches: (i) => has(POLICY)(i.text),
    drawers: [
      { id: "delivery_charge", matches: has(/delivery|ডেলিভারি|charge|চার্জ/), tools: ["getDeliveryCharge"], instruction: "Delivery charge/time only from getDeliveryCharge and store policy." },
      { id: "return_policy", matches: has(/return|রিটার্ন|exchange|এক্সচেঞ্জ|ফেরত/), instruction: "State return/exchange rules only from the store policy section." },
      { id: "payment_methods", matches: has(/bkash|বিকাশ|nagad|নগদ|payment|পেমেন্ট|cod|ক্যাশ অন/), instruction: "Mention only payment methods the store has enabled." },
    ],
  });
  registerAgent({
    id: "product", priority: 20, matches: (i) => has(PRODUCT)(i.text),
    drawers: [
      { id: "catalog_cards", matches: () => true, tools: ["searchProducts"], instruction: "Search this store only and show matching product cards." },
      { id: "variants", matches: has(/size|সাইজ|color|colou?r|কালার|রং|variant/), instruction: "Only offer sizes/colours present in the product's variants." },
      { id: "stock_alternatives", matches: has(/stock|স্টক|আছে|নাই|নেই/), instruction: "If out of stock, suggest an in-stock item from the same store." },
    ],
  });
  registerAgent({
    id: "frontline", priority: 10, matches: () => true,
    drawers: [
      { id: "greetings", matches: has(GREET), instruction: "Greet warmly in one short line and ask how you can help." },
      { id: "message_refiner", matches: (t) => t.length > 120, instruction: "Identify the customer's main need first; answer that only." },
      { id: "store_intro", matches: has(/কি বিক্রি|what do you sell|কী আছে|shop|দোকান/), instruction: "Briefly describe what this store sells." },
    ],
  });
}

/** Short prompt section for the chosen specialist + open drawers. */
export function specialistFocus(storeId: string, channel: AgentChannel, text: string): { agentId: string; drawerIds: string[]; prompt: string } {
  registerSpecialists();
  const r = routeMessage({ storeId, channel, text: text ?? "" });
  if (!r) return { agentId: "frontline", drawerIds: [], prompt: "" };
  const lines = r.drawers.map((d) => d.instruction).filter(Boolean);
  return {
    agentId: r.agent.id,
    drawerIds: r.drawers.map((d) => d.id),
    prompt: lines.length ? `# Focus (${r.agent.id} specialist)\n${lines.map((l) => `- ${l}`).join("\n")}` : "",
  };
}

export const _specialistCount = () => (registerSpecialists(), listAgents().length);
