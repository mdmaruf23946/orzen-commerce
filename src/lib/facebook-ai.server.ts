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

// ---------------------------------------------------------------------------
// Live comment handling (webhook path)
// A new customer comment is classified, answered and — when the store turned
// the automatic switches on — moderated without waiting for a human.
// ---------------------------------------------------------------------------

type IncomingComment = {
  comment_id: string;
  message: string;
  author_id: string | null;
  author_name: string | null;
  post_excerpt?: string | null;
};

type Classified = { category: Analysis["category"]; suggestion: string };

async function classifyOne(settings: any, store: any, c: IncomingComment): Promise<Classified> {
  const deny: string[] = (settings?.deny_keywords ?? []).map((k: string) => String(k).toLowerCase()).filter(Boolean);
  const text = (c.message ?? "").toLowerCase();
  if (deny.length && deny.some((k) => text.includes(k))) return { category: "spam", suggestion: "" };
  if (!text.trim()) return { category: "other", suggestion: "" };

  const lang =
    settings?.language === "bn" ? "Bangla" : settings?.language === "en" ? "English" : "the same language as the comment";
  const { routedModel } = await import("@/lib/ai-provider.server");
  const aiModel = await routedModel("google/gemini-2.5-flash");

  const prompt = [
    `You moderate the Facebook Page comments of the online store "${store?.name ?? "this store"}".`,
    store?.description ? `Store description: ${store.description}` : "",
    `Reply tone: ${settings?.tone ?? "friendly"}. Reply language: ${lang}.`,
    settings?.custom_instructions ? `Owner instructions: ${settings.custom_instructions}` : "",
    "",
    `Comment from ${c.author_name ?? "a customer"} on post "${(c.post_excerpt ?? "").slice(0, 80)}":`,
    `"${(c.message ?? "").slice(0, 600)}"`,
    "",
    "Answer with a JSON array holding exactly one object:",
    `[{"comment_id":"${c.comment_id}","category":"one of ${CATEGORIES.join("|")}","suggestion":"short polite public reply, empty for spam or abusive"}]`,
    "Reply directly to what the comment actually says. No prose outside the JSON.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text: out } = await generateText({ model: aiModel, prompt });
    const parsed = safeJson(out);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    const category = (CATEGORIES as readonly string[]).includes(first?.category) ? first.category : "other";
    const suggestion = typeof first?.suggestion === "string" ? first.suggestion.slice(0, 1500) : "";
    return { category, suggestion };
  } catch {
    return { category: "other", suggestion: "" };
  }
}

async function recordAction(
  supabase: any,
  storeId: string,
  c: IncomingComment,
  action: "reply" | "hide" | "delete" | "block",
  category: string,
  reason: string,
  opts: { auto: boolean; suggestion?: string; run?: () => Promise<void> },
) {
  const base: any = {
    store_id: storeId,
    comment_id: c.comment_id,
    author_id: c.author_id,
    author_name: c.author_name,
    message: c.message,
    category,
    action,
    reason,
    suggestion: opts.suggestion ?? null,
  };

  if (!opts.auto || !opts.run) {
    await supabase
      .from("facebook_moderation_queue")
      .upsert([{ ...base, status: "pending" }], { onConflict: "store_id,comment_id,action", ignoreDuplicates: true });
    return { done: false, error: null as string | null };
  }

  try {
    await opts.run();
    await supabase.from("facebook_moderation_queue").upsert(
      [{ ...base, status: "approved", decided_by: "ai", decided_at: new Date().toISOString(), error: null }],
      { onConflict: "store_id,comment_id,action" },
    );
    return { done: true, error: null as string | null };
  } catch (e) {
    const { explainGraphError } = await import("@/lib/facebook-errors.server");
    const message = explainGraphError(e);
    await supabase.from("facebook_moderation_queue").upsert(
      [{ ...base, status: "failed", decided_by: "ai", decided_at: new Date().toISOString(), error: message }],
      { onConflict: "store_id,comment_id,action" },
    );
    return { done: false, error: message };
  }
}

/**
 * Handles one freshly received comment end to end. Never throws — a Facebook or
 * AI failure must not break webhook delivery. Always scoped to the store that
 * owns the signed Page ID.
 */
export async function handleIncomingComment(
  supabase: any,
  storeId: string,
  pageId: string,
  token: string | null,
  c: IncomingComment,
) {
  try {
    if (!token) return { ok: false, reason: "no_token" };

    const [{ data: settings }, { data: store }] = await Promise.all([
      supabase.from("facebook_ai_settings").select("*").eq("store_id", storeId).maybeSingle(),
      supabase.from("stores").select("name, description").eq("id", storeId).maybeSingle(),
    ]);
    if (!settings?.enabled) return { ok: false, reason: "ai_off" };

    // Claim the comment so a webhook retry can never answer it twice.
    const { data: claimed } = await supabase
      .from("facebook_comments")
      .update({ ai_status: "processing" })
      .eq("store_id", storeId)
      .eq("comment_id", c.comment_id)
      .neq("ai_status", "processing")
      .neq("ai_status", "done")
      .select("comment_id");
    if (!claimed?.length) return { ok: false, reason: "already_handled" };

    const { category, suggestion } = await classifyOne(settings, store, c);
    const { graphPost, graphDelete } = await import("@/lib/facebook-page.server");

    await supabase
      .from("facebook_comments")
      .update({
        ai_category: category,
        ai_suggestion: suggestion || null,
        ai_status: suggestion ? "suggested" : "flagged",
      })
      .eq("store_id", storeId)
      .eq("comment_id", c.comment_id);

    const autoMode = settings.mode === "auto";

    if (category === "abusive") {
      const auto = autoMode && !!settings.auto_delete_abusive;
      const res = await recordAction(supabase, storeId, c, "delete", category, "Abusive comment removed automatically.", {
        auto,
        run: async () => {
          await graphDelete(`/${encodeURIComponent(c.comment_id)}`, token);
          await supabase.from("facebook_comments").delete().eq("store_id", storeId).eq("comment_id", c.comment_id);
        },
      });
      if (c.author_id) {
        await recordAction(supabase, storeId, c, "block", category, "Repeat abusive commenter — block suggested.", {
          auto: false,
        });
      }
      return { ok: true, category, deleted: res.done };
    }

    if (category === "spam") {
      const auto = autoMode && !!settings.auto_hide_spam;
      const res = await recordAction(supabase, storeId, c, "hide", category, "Spam comment hidden automatically.", {
        auto,
        run: async () => {
          await graphPost(`/${encodeURIComponent(c.comment_id)}`, token, { is_hidden: "true" });
          await supabase
            .from("facebook_comments")
            .update({ hidden: true })
            .eq("store_id", storeId)
            .eq("comment_id", c.comment_id);
        },
      });
      return { ok: true, category, hidden: res.done };
    }

    if (!suggestion) return { ok: true, category, replied: false };

    const auto = autoMode && !!settings.auto_reply_safe;
    const res = await recordAction(supabase, storeId, c, "reply", category, "AI replied to this comment.", {
      auto,
      suggestion,
      run: async () => {
        await graphPost(`/${encodeURIComponent(c.comment_id)}/comments`, token, { message: suggestion });
        await supabase
          .from("facebook_comments")
          .update({ replied: true, ai_status: "done" })
          .eq("store_id", storeId)
          .eq("comment_id", c.comment_id);
      },
    });

    // Bring the commenter into the Messenger inbox (one private reply allowed
    // per comment, within 7 days).
    if (res.done && settings.suggest_messenger_handoff !== false) {
      const intro =
        settings.language === "en"
          ? `Hi${c.author_name ? ` ${c.author_name}` : ""}! Thanks for your comment. You can continue here in Messenger and we will help you right away.`
          : `আসসালামু আলাইকুম${c.author_name ? ` ${c.author_name}` : ""}! আপনার কমেন্টের জন্য ধন্যবাদ। এখানে Messenger-এ লিখুন, আমরা সরাসরি সাহায্য করছি।`;
      try {
        await graphPost(`/${encodeURIComponent(pageId)}/messages`, token, {
          recipient: JSON.stringify({ comment_id: c.comment_id }),
          message: JSON.stringify({ text: intro }),
          messaging_type: "RESPONSE",
        });
      } catch {
        /* private reply is best-effort (already used, or permission missing) */
      }
    }

    return { ok: true, category, replied: res.done };
  } catch {
    return { ok: false, reason: "error" };
  }
}
