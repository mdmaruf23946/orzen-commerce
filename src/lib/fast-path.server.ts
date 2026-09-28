// Fast-path replies: answer simple, fully-verifiable messages straight from
// the database without an AI call. Returns null whenever unsure, so the
// normal AI path handles it — never guesses.
import { orderStatusBn, shortOrderNo } from "@/lib/chat-order-format";

const BENGALI = /[\u0980-\u09FF]/;

const GREETING = /^(hi+|hello+|hey+|hlw|helo|assalamu? ?alaikum|salam|আসসালামু ?আলাইকুম|সালাম|হাই|হ্যালো|হেলো|হেই)[\s!.।,]*$/i;
const THANKS = /^((?:ok+|okay|ওকে)[\s,]+(?:thanks?|thank you|ধন্যবাদ)|thanks?|thank you|thx|tnx|ok+|okay|oky|accha|আচ্ছা|ঠিক আছে|ধন্যবাদ|ওকে|থ্যাংকস?|থ্যাঙ্ক ইউ)[\s!.।,]*$/i;
const STATUS_WORDS = /(order|অর্ডার|অডার).{0,20}(status|kothay|koi|কই|কোথায়|কী অবস্থা|কি অবস্থা|track|ট্র্যাক|আপডেট|update)|(track|ট্র্যাক).{0,10}(order|অর্ডার)|parcel (koi|kothay)|পার্সেল (কই|কোথায়)/i;
const ORDER_NO = /\b([A-Z]{1,6}[-_]?\d{3,}|\d{5,10})\b/i;
const DELIVERY_Q = /^(?:delivery|ডেলিভারি|ডেলিভারী|deli?very)\s*(?:charge|চার্জ|cost|fee|খরচ)\s*(?:koto|kto|কত|কতো|how much)?\s*(?:taka|টাকা)?[\s?!.।]*$|^(?:how much|what is)(?: the)? delivery (?:charge|cost|fee)[\s?]*$/i;
const DELIVERY_TIME_Q = /^(?:delivery|ডেলিভারি|ডেলিভারী)\s*(?:(?:koto|কত|কতো)\s*(?:din|দিন|দিনে)|(?:time|সময়|somoy)|(?:hote|হতে|পেতে|dite|দিতে)?\s*(?:koto|কত|কতো)\s*(?:din|দিন|দিনে|সময়))\s*(?:lage|লাগে|লাগবে|hobe|হবে)?[\s?!.।]*$|^(?:how long|how many days)(?: does| will)?(?: it take)?(?: for)? delivery[\s?]*$|^(?:koto|কত|কতো)\s*(?:din|দিনে|দিন)\s*(?:delivery|ডেলিভারি)\s*(?:pabo|পাবো|পাব|হবে|দিবেন)?[\s?!.।]*$/i;
const RETURN_Q = /^(?:return|রিটার্ন|ফেরত|exchange|এক্সচেঞ্জ)\s*(?:policy|পলিসি|নীতি)?\s*(?:ki|কি|কী|ache|আছে|deya jay|দেওয়া যায়|দেয়া যায়|করা যায়|হবে)?\s*(?:ki|কি|কী)?[\s?!.।]*$|^(?:what is|what's)(?: your| the)? return policy[\s?]*$|^can i return[\s\w]{0,20}\??$/i;

export type FastPathResult = {
  reply: string;
  kind: "greeting" | "thanks" | "order_status" | "delivery_charge" | "delivery_time" | "return_policy";
} | null;

function phoneTail(p: string | null | undefined) {
  const d = String(p ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

export async function tryFastPath(
  sb: any,
  opts: { storeId: string; conversationId: string; text: string; customerPhone?: string | null },
): Promise<FastPathResult> {
  const text = (opts.text ?? "").trim();
  if (!text || text.length > 120 || text.includes("\n")) return null;
  const bn = BENGALI.test(text);

  if (GREETING.test(text)) {
    const { data: store } = await sb.from("stores").select("name").eq("id", opts.storeId).maybeSingle();
    const name = store?.name ? ` ${store.name}-এ` : "";
    return {
      kind: "greeting",
      reply: bn || /salam|alaikum/i.test(text)
        ? `ওয়ালাইকুম আসসালাম!${name} স্বাগতম। কোন পণ্যটি খুঁজছেন? নাম লিখুন বা ছবি পাঠান।`
        : `Hello!${store?.name ? ` Welcome to ${store.name}.` : ""} What are you looking for? Type a product name or send a photo.`,
    };
  }
  if (THANKS.test(text)) {
    return {
      kind: "thanks",
      reply: bn ? "আপনাকেও ধন্যবাদ! আর কিছু লাগলে জানাবেন।" : "You're welcome! Let us know if you need anything else.",
    };
  }

  // Generic delivery-charge question (no product, no area) → list the store's
  // own active zones verbatim. Anything more specific goes to the AI tool.
  if (DELIVERY_Q.test(text) && text.length <= 60) {
    const { fetchDeliveryZones } = await import("@/lib/chat-order-format");
    const zones = (await fetchDeliveryZones(sb, opts.storeId)).filter((z) => z.name && Number.isFinite(z.charge));
    if (zones.length < 1 || zones.length > 4) return null;
    const lines = zones.map((z) => `• ${z.name}: ৳${z.charge}${z.eta ? ` (${z.eta})` : ""}`).join("\n");
    return {
      kind: "delivery_charge",
      reply: bn
        ? `আমাদের ডেলিভারি চার্জ:\n${lines}\nআপনার এলাকা জানালে সঠিক চার্জ বলে দিতে পারব।`
        : `Our delivery charges:\n${lines}\nTell us your area for the exact charge.`,
    };
  }

  // Generic delivery-time / return-policy questions → merchant's own settings.
  if (text.length <= 70 && (DELIVERY_TIME_Q.test(text) || RETURN_Q.test(text))) {
    const { loadStorePolicy, deliveryTimeText, returnPolicyText } = await import("@/lib/store-policy.server");
    const p = await loadStorePolicy(sb, opts.storeId);
    const reply = DELIVERY_TIME_Q.test(text) ? deliveryTimeText(p, bn) : returnPolicyText(p, bn);
    if (reply) return { kind: DELIVERY_TIME_Q.test(text) ? "delivery_time" : "return_policy", reply };
    return null;
  }

  const numMatch = text.match(ORDER_NO);
  if (!STATUS_WORDS.test(text) && !(numMatch && /(order|অর্ডার|invoice)/i.test(text))) return null;

  const cols = "id,invoice_no,status,courier_status,created_at,phone";
  let rows: any[] = [];
  if (numMatch) {
    const { data } = await sb
      .from("orders")
      .select(cols)
      .eq("store_id", opts.storeId)
      .ilike("invoice_no", `%${numMatch[1]}%`)
      .limit(2);
    rows = data ?? [];
    // Only reveal an order looked up by number to the customer who placed it.
    const mine = phoneTail(opts.customerPhone);
    if (rows.length === 1 && (!mine || phoneTail(rows[0].phone) !== mine)) rows = [];
  } else {
    const tail = phoneTail(opts.customerPhone);
    if (!tail) return null;
    const { data } = await sb
      .from("orders")
      .select(cols)
      .eq("store_id", opts.storeId)
      .ilike("phone", `%${tail}`)
      .order("created_at", { ascending: false })
      .limit(2);
    rows = data ?? [];
  }
  // Ambiguous (0 or several) → let the AI ask a clarifying question.
  if (rows.length !== 1) return null;
  const o = rows[0];
  const no = shortOrderNo(o.invoice_no, o.id);
  const courier = o.courier_status ? (bn ? ` কুরিয়ার: ${o.courier_status}।` : ` Courier: ${o.courier_status}.`) : "";
  return {
    kind: "order_status",
    reply: bn
      ? `আপনার অর্ডার #${no} এর বর্তমান অবস্থা: ${orderStatusBn(o.status)}।${courier}`
      : `Your order #${no} is currently: ${o.status}.${courier}`,
  };
}
