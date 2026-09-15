// Server-only AI helper for Facebook Page comment management.
// Dedicated to this module — the Messenger agent prompts are untouched.
import { generateText } from "ai";

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


  const [{ data: settings }, { data: comments }, { data: store }] = await Promise.all([
    supabase.from("facebook_ai_settings").select("*").eq("store_id", storeId).maybeSingle(),
    supabase
      .from("facebook_comments")
      .select("comment_id, message, author_id, author_name, post_excerpt")
      .eq("store_id", storeId)
      .in("comment_id", commentIds),
    supabase.from("stores").select("name, description").eq("id", storeId).maybeSingle(),
  ]);

  if (!settings?.enabled) throw new Error("AI comment management is turned off.");
  if (!comments?.length) return { ok: true, analyzed: 0 };

  const lang =
    settings.language === "bn" ? "Bangla" : settings.language === "en" ? "English" : "the same language as the comment";

  const { routedModel } = await import("@/lib/ai-provider.server");
  const aiModel = await routedModel("google/gemini-2.5-flash");
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
    model: aiModel,
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

  const byId = new Map<string, any>((comments ?? []).map((c: any) => [c.comment_id, c]));
  const proposals: any[] = [];

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

    // Destructive actions are never executed by the AI — they are queued for
    // the owner to approve on the Moderation tab.
    const src = byId.get(r.comment_id) ?? {};
    const base = {
      store_id: storeId,
      comment_id: r.comment_id,
      author_id: src.author_id ?? null,
      author_name: src.author_name ?? null,
      message: src.message ?? null,
      category: r.category,
      status: "pending",
    };
    if (r.category === "spam") {
      proposals.push({ ...base, action: "hide", reason: "AI flagged this comment as spam." });
    } else if (r.category === "abusive") {
      proposals.push({ ...base, action: "delete", reason: "AI flagged this comment as abusive." });
      if (src.author_id) {
        proposals.push({ ...base, action: "block", reason: "Repeat abusive commenter — block suggested." });
      }
    } else if (r.suggestion) {
      proposals.push({
        ...base,
        action: "reply",
        reason: "AI drafted a public reply for your approval.",
        suggestion: r.suggestion,
      });
    }
  }

  if (proposals.length) {
    await supabase
      .from("facebook_moderation_queue")
      .upsert(proposals, { onConflict: "store_id,comment_id,action", ignoreDuplicates: true });
  }

  return { ok: true, analyzed: results.length, queued: proposals.length, results };
}
