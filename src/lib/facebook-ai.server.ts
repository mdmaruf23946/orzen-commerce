// Server-only AI helper for Facebook Page comment management.
// Dedicated to this module — the Messenger agent prompts are untouched.
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Analysis = {
  comment_id: string;
  category: "question" | "order_intent" | "praise" | "spam" | "abusive" | "other";
  suggestion: string;
};

const CATEGORIES = ["question", "order_intent", "praise", "spam", "abusive", "other"] as const;

function safeJson(text: string): any {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  try {
    return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    return null;
  }
}

export async function analyzeComments(supabase: any, storeId: string, commentIds: string[]) {
  if (!commentIds.length) return { ok: true, analyzed: 0 };

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured for this workspace.");

  const [{ data: settings }, { data: comments }, { data: store }] = await Promise.all([
    supabase.from("facebook_ai_settings").select("*").eq("store_id", storeId).maybeSingle(),
    supabase
      .from("facebook_comments")
      .select("comment_id, message, author_name, post_excerpt")
      .eq("store_id", storeId)
      .in("comment_id", commentIds),
    supabase.from("stores").select("name, description").eq("id", storeId).maybeSingle(),
  ]);

  if (!settings?.enabled) throw new Error("AI comment management is turned off.");
  if (!comments?.length) return { ok: true, analyzed: 0 };

  const lang =
    settings.language === "bn" ? "Bangla" : settings.language === "en" ? "English" : "the same language as the comment";

  const provider = createLovableAiGatewayProvider(apiKey);
  const prompt = [
    `You moderate the Facebook Page comments of the online store "${store?.name ?? "this store"}".`,
    store?.description ? `Store description: ${store.description}` : "",
    `Reply tone: ${settings.tone}. Reply language: ${lang}.`,
    settings.custom_instructions ? `Owner instructions: ${settings.custom_instructions}` : "",
    settings.deny_keywords?.length ? `Treat comments containing any of these as spam: ${settings.deny_keywords.join(", ")}` : "",
    "",
    "For every comment return an object with: comment_id, category (one of " + CATEGORIES.join(", ") + "), and suggestion (a short, polite public reply; empty string for spam or abusive).",
    "Answer with a JSON array only, no prose.",
    "",
    "Comments:",
    ...comments.map(
      (c: any, i: number) =>
        `${i + 1}. comment_id=${c.comment_id} | from=${c.author_name ?? "customer"} | post="${(c.post_excerpt ?? "").slice(0, 80)}" | text="${(c.message ?? "").slice(0, 400)}"`,
    ),
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateText({
    model: provider("google/gemini-2.5-flash"),
    prompt,
  });

  const parsed = safeJson(text);
  if (!Array.isArray(parsed)) throw new Error("AI returned an unexpected response. Please try again.");

  const results: Analysis[] = parsed
    .filter((r: any) => r && typeof r.comment_id === "string")
    .map((r: any) => ({
      comment_id: String(r.comment_id),
      category: (CATEGORIES as readonly string[]).includes(r.category) ? r.category : "other",
      suggestion: typeof r.suggestion === "string" ? r.suggestion.slice(0, 1500) : "",
    }));

  for (const r of results) {
    await supabase
      .from("facebook_comments")
      .update({
        ai_category: r.category,
        ai_suggestion: r.suggestion || null,
        ai_status: r.suggestion ? "suggested" : "flagged",
      })
      .eq("store_id", storeId)
      .eq("comment_id", r.comment_id);
  }

  return { ok: true, analyzed: results.length, results };
}
