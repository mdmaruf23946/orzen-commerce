// Co-pilot thinking loop: the model calls store-scoped tools on demand and
// answers only from their compact results. Drafts are never saved here.
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { resolveAiModel } from "@/lib/agents/ai-provider.server";
import { smallTalkReply } from "./small-talk";
import { copilotActionSchema, stripUnaskedSalam, type CopilotAction } from "./actions";
import { draftProduct, loadProductPerformance, loadSalesSummary, loadSeoAudit, loadStoreConfig } from "./data.server";

export const COPILOT_SYSTEM = `তুমি ORZEN-এর AI Business Co-pilot — একজন অভিজ্ঞ বাংলাদেশি ই-কমার্স পরামর্শক।
নিয়ম:
- মার্চেন্ট যে ভাষায় লেখেন (বাংলা/Banglish/English) সেই ভাষায় সংক্ষেপে, স্পষ্টভাবে উত্তর দাও।
- বিক্রি, প্রোডাক্ট, স্টক, এসইও বা সেটিংস নিয়ে যেকোনো সংখ্যা/তথ্য শুধু টুলের ফল থেকে বলবে; অনুমান বা বানানো সংখ্যা নিষেধ।
- প্রয়োজন ছাড়া টুল ডাকবে না; সাধারণ পরামর্শে টুল লাগে না।
- তথ্য দেখানোর পর ২–৪টি কাজে লাগানোর মতো পরামর্শ দাও।
- নতুন প্রোডাক্ট চাইলে draft_product টুল দিয়ে খসড়া বানাও এবং বলো: "নিশ্চিত করলে সেভ হবে" — তুমি নিজে কিছু সেভ করো না।
- টুলে তথ্য না থাকলে সৎভাবে বলো যে তথ্য নেই।
- শিষ্টাচার: শুধু মার্চেন্টের সর্বশেষ মেসেজে সালাম থাকলেই "ওয়ালাইকুম আসসালাম" বলবে। সালাম না থাকলে কোনো সালাম/সম্ভাষণ ছাড়া সরাসরি কাজের কথা বলবে।
- মার্চেন্ট কিছু ঠিক/পরিবর্তন করতে বললে (এসইও, দাম, স্টক, প্রোডাক্ট বিবরণ, ডেলিভারি চার্জ) আগে দরকারি তথ্য টুল দিয়ে দেখবে, তারপর propose_* টুল দিয়ে পরিবর্তনের প্রস্তাব বানাবে এবং বলবে "নিচের কার্ডে নিশ্চিত করলে সেভ হবে"। শুধু পরামর্শ দিয়ে থামবে না।
- এসইও ঠিক করতে: store meta title (≤60 অক্ষর) ও description (৫০–১৬০ অক্ষর) প্রস্তাব করো, এবং বিবরণ নেই/ছোট এমন প্রোডাক্টে (সর্বোচ্চ ৫টি) আকর্ষণীয় বাংলা বিবরণ propose_product_update দিয়ে প্রস্তাব করো।
- ডিজাইন/থিম বা যে কাজ টুল দিয়ে করা যায় না, সেখানে ছোট করে কোন মেনুতে গিয়ে করতে হবে বলো (যেমন Store Design)।
- "কেমন আছেন" জিজ্ঞেস করলে সংক্ষেপে "আলহামদুলিল্লাহ ভালো আছি" বলে মূল কথায় যাবে।
- সাধারণ বা ছোট প্রশ্নে ১–৩ বাক্যে সরাসরি উত্তর দাও; ভূমিকা, প্রশ্নের পুনরাবৃত্তি বা লম্বা তালিকা দিও না।
- আগের উত্তরের কথা হুবহু আবার বলবে না।`;

export type CopilotMessage = { role: "user" | "assistant"; content: string };
export type CopilotDraft = ReturnType<typeof draftProduct>["draft"];

function propose(actions: CopilotAction[], input: unknown, before?: Record<string, string | number | null>) {
  const r = copilotActionSchema.safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => i.message).join("; ") };
  if (actions.length >= 8) return { ok: false, error: "Too many proposals in one reply" };
  actions.push({ ...r.data, before });
  return { ok: true, requiresConfirmation: true };
}

export function buildCopilotTools(db: any, storeId: string, drafts: CopilotDraft[], actions: CopilotAction[] = []) {
  const days = z.object({ days: z.number().int().min(1).max(365).default(30) });
  return {
    propose_store_seo: tool({
      description: "Propose a new store SEO meta title and description. Merchant confirms before saving.",
      inputSchema: z.object({ title: z.string(), description: z.string() }),
      execute: async (i) => {
        const { data } = await db.from("stores").select("seo").eq("id", storeId).maybeSingle();
        return propose(actions, { type: "store_seo", ...i }, { title: data?.seo?.title ?? data?.seo?.meta_title ?? null, description: data?.seo?.description ?? data?.seo?.meta_description ?? null });
      },
    }),
    propose_product_update: tool({
      description: "Propose changing an existing product's price, stock and/or description. productId must come from a tool result. Merchant confirms before saving.",
      inputSchema: z.object({ productId: z.string(), price: z.number().optional(), stock: z.number().int().optional(), description: z.string().optional() }),
      execute: async (i) => {
        const { data } = await db.from("products").select("id,name,price,stock").eq("id", i.productId).eq("store_id", storeId).maybeSingle();
        if (!data) return { ok: false, error: "Product not found in this store" };
        return propose(actions, { type: "product_update", productName: data.name, ...i }, { price: data.price, stock: data.stock });
      },
    }),
    propose_delivery_charge: tool({
      description: "Propose a new delivery charge for an existing delivery zone (zoneId from get_store_configuration). Merchant confirms before saving.",
      inputSchema: z.object({ zoneId: z.string(), charge: z.number() }),
      execute: async (i) => {
        const { data } = await db.from("delivery_zones").select("id,name,charge").eq("id", i.zoneId).eq("store_id", storeId).maybeSingle();
        if (!data) return { ok: false, error: "Zone not found in this store" };
        return propose(actions, { type: "delivery_charge", zoneName: data.name, ...i }, { charge: data.charge });
      },
    }),
    find_products: tool({
      description: "Search this store's products by name; returns id, name, price, stock.",
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: async ({ query }) => {
        const q = query.replace(/[%,()]/g, " ").trim();
        const { data } = await db.from("products").select("id,name,price,stock,status").eq("store_id", storeId).ilike("name", `%${q}%`).limit(10);
        return data ?? [];
      },
    }),
    get_sales_summary: tool({
      description: "Revenue, order count, average order value, cancellation rate, repeat customers and conversion for the last N days.",
      inputSchema: days,
      execute: ({ days }) => loadSalesSummary(db, storeId, days),
    }),
    get_product_performance: tool({
      description: "Best sellers, dead stock and low-stock products for the last N days.",
      inputSchema: days,
      execute: ({ days }) => loadProductPerformance(db, storeId, days),
    }),
    analyze_store_seo: tool({
      description: "SEO health score and missing descriptions/images/meta for the store and its products.",
      inputSchema: z.object({}),
      execute: () => loadSeoAudit(db, storeId),
    }),
    get_store_configuration: tool({
      description: "Delivery zones and charges, configured couriers, custom domain and return policy status.",
      inputSchema: z.object({}),
      execute: () => loadStoreConfig(db, storeId),
    }),
    draft_product: tool({
      description: "Prepare a NEW product draft for the merchant to confirm. Never saves.",
      inputSchema: z.object({
        name: z.string().min(1), price: z.number().nonnegative(), stock: z.number().int().optional(),
        description: z.string().optional(),
      }),
      execute: (input) => { const r = draftProduct(input); drafts.push(r.draft); return r; },
    }),
  };
}

export async function runCopilot(db: any, storeId: string, messages: CopilotMessage[]) {
  const last = messages[messages.length - 1];
  const quick = last?.role === "user" ? smallTalkReply(last.content) : null;
  if (quick) return { reply: quick, drafts: [] as CopilotDraft[], actions: [] as CopilotAction[], toolsUsed: [] as string[] };
  const ai = await resolveAiModel();
  const drafts: CopilotDraft[] = [];
  const actions: CopilotAction[] = [];
  const result = await generateText({
    model: ai.model,
    system: COPILOT_SYSTEM,
    messages: messages.slice(-12),
    tools: buildCopilotTools(db, storeId, drafts, actions),
    stopWhen: stepCountIs(6),
    temperature: 0.3,
    maxOutputTokens: 1500,
  });
  const toolsUsed = result.steps.flatMap((s: any) => (s.toolCalls ?? []).map((c: any) => c.toolName));
  return { reply: stripUnaskedSalam(result.text, last?.content ?? ""), drafts, actions, toolsUsed };
}
