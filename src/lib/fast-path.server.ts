// Fast-path replies: answer simple, fully-verifiable messages straight from
// the database without an AI call. Returns null whenever unsure, so the
// normal AI path handles it — never guesses.
import { orderStatusBn, shortOrderNo } from "@/lib/chat-order-format";

const BENGALI = /[\u0980-\u09FF]/;

const GREETING = /^(hi+|hello+|hey+|hlw|helo|assalamu? ?alaikum|salam|আসসালামু ?আলাইকুম|সালাম|হাই|হ্যালো|হেলো|হেই)[\s!.।,]*$/i;
const THANKS = /^((?:ok+|okay|ওকে)[\s,]+(?:thanks?|thank you|ধন্যবাদ)|thanks?|thank you|thx|tnx|ok+|okay|oky|accha|আচ্ছা|ঠিক আছে|ধন্যবাদ|ওকে|থ্যাংকস?|থ্যাঙ্ক ইউ)[\s!.।,]*$/i;
const STATUS_WORDS = /(order|অর্ডার|অডার).{0,20}(status|kothay|koi|কই|কোথায়|কী অবস্থা|কি অবস্থা|track|ট্র্যাক|আপডেট|update)|(track|ট্র্যাক).{0,10}(order|অর্ডার)|parcel (koi|kothay)|পার্সেল (কই|কোথায়)/i;
const ORDER_NO = /\b([A-Z]{1,6}[-_]?\d{3,}|\d{5,10})\b/i;

export type FastPathResult = { reply: string; kind: "greeting" | "thanks" | "order_status" } | null;

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
    if (rows.length === 1 && mine && phoneTail(rows[0].phone) !== mine) rows = [];
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
