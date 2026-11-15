// Co-pilot thinking loop: the model calls store-scoped tools on demand and
// answers only from their compact results. Drafts are never saved here.
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { resolveAiModel } from "@/lib/agents/ai-provider.server";
import { smallTalkReply } from "./small-talk";
import { draftProduct, loadProductPerformance, loadSalesSummary, loadSeoAudit, loadStoreConfig } from "./data.server";

export const COPILOT_SYSTEM = `তুমি ORZEN-এর AI Business Co-pilot — একজন অভিজ্ঞ বাংলাদেশি ই-কমার্স পরামর্শক।
নিয়ম:
- মার্চেন্ট যে ভাষায় লেখেন (বাংলা/Banglish/English) সেই ভাষায় সংক্ষেপে, স্পষ্টভাবে উত্তর দাও।
- বিক্রি, প্রোডাক্ট, স্টক, এসইও বা সেটিংস নিয়ে যেকোনো সংখ্যা/তথ্য শুধু টুলের ফল থেকে বলবে; অনুমান বা বানানো সংখ্যা নিষেধ।
- প্রয়োজন ছাড়া টুল ডাকবে না; সাধারণ পরামর্শে টুল লাগে না।
- তথ্য দেখানোর পর ২–৪টি কাজে লাগানোর মতো পরামর্শ দাও।
- নতুন প্রোডাক্ট চাইলে draft_product টুল দিয়ে খসড়া বানাও এবং বলো: "নিশ্চিত করলে সেভ হবে" — তুমি নিজে কিছু সেভ করো না।
- টুলে তথ্য না থাকলে সৎভাবে বলো যে তথ্য নেই।
- শিষ্টাচার: মার্চেন্ট সালাম দিলে উত্তর শুরু করবে "ওয়ালাইকুম আসসালাম" দিয়ে; কখনো পাল্টা "আসসালামু আলাইকুম" বলবে না। নিজে থেকে সালাম দিয়ে উত্তর শুরু করবে না।
- "কেমন আছেন" জিজ্ঞেস করলে সংক্ষেপে "আলহামদুলিল্লাহ ভালো আছি" বলে মূল কথায় যাবে।
- সাধারণ বা ছোট প্রশ্নে ১–৩ বাক্যে সরাসরি উত্তর দাও; ভূমিকা, প্রশ্নের পুনরাবৃত্তি বা লম্বা তালিকা দিও না।
- আগের উত্তরের কথা হুবহু আবার বলবে না।`;

export type CopilotMessage = { role: "user" | "assistant"; content: string };
export type CopilotDraft = ReturnType<typeof draftProduct>["draft"];

export function buildCopilotTools(db: any, storeId: string, drafts: CopilotDraft[]) {
  const days = z.object({ days: z.number().int().min(1).max(365).default(30) });
  return {
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
  if (quick) return { reply: quick, drafts: [] as CopilotDraft[], toolsUsed: [] as string[] };
  const ai = await resolveAiModel();
  const drafts: CopilotDraft[] = [];
  const result = await generateText({
    model: ai.model,
    system: COPILOT_SYSTEM,
    messages: messages.slice(-12),
    tools: buildCopilotTools(db, storeId, drafts),
    stopWhen: stepCountIs(4),
    temperature: 0.3,
    maxOutputTokens: 900,
  });
  const toolsUsed = result.steps.flatMap((s: any) => (s.toolCalls ?? []).map((c: any) => c.toolName));
  return { reply: result.text, drafts, toolsUsed };
}
